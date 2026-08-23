import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();

    let query = supabase.from('field_service_groups').select('*').order('sort_order', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { data: groups, error } = await query;
    if (error) throw error;

    const groupIds = (groups || []).map((g: any) => g.id);
    const membersByGroup: Record<string, any[]> = {};
    if (groupIds.length) {
      const db = getDb();
      const placeholders = groupIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT m.id, m.group_id, m.user_id, m.role, m.sort_order,
               u.id as u_id, u.first_name, u.last_name, u.display_name, u.name as u_name,
               u.gender, u.is_elder, u.is_ministerial_servant,
               u.is_regular_pioneer, u.is_auxiliary_pioneer, u.is_special_pioneer,
               u.is_publisher, u.is_unbaptized_publisher
        FROM field_service_group_members m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.group_id IN (${placeholders})
        ORDER BY m.sort_order ASC
      `).all(...groupIds) as Record<string, unknown>[];
      for (const m of rows) {
        const gid = m.group_id as string;
        if (!membersByGroup[gid]) membersByGroup[gid] = [];
        membersByGroup[gid].push({
          id: m.id, group_id: m.group_id, user_id: m.user_id, role: m.role, sort_order: m.sort_order,
          user: m.u_id ? { id: m.u_id, first_name: m.first_name, last_name: m.last_name,
            display_name: m.display_name, name: m.u_name, gender: m.gender,
            is_elder: !!m.is_elder, is_ministerial_servant: !!m.is_ministerial_servant,
            is_regular_pioneer: !!m.is_regular_pioneer, is_auxiliary_pioneer: !!m.is_auxiliary_pioneer,
            is_special_pioneer: !!m.is_special_pioneer, is_publisher: !!m.is_publisher,
            is_unbaptized_publisher: !!m.is_unbaptized_publisher } : null,
        });
      }
    }

    const result = (groups || []).map((g: any) => ({ ...g, members: membersByGroup[g.id] || [] }));
    return NextResponse.json({ groups: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch groups';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    const { data, error } = await supabase
      .from('field_service_groups')
      .insert({ name: body.name || 'New Group', meeting_day: body.meeting_day || null, meeting_time: body.meeting_time || null, meeting_location: body.meeting_location || null, sort_order: body.sort_order || 0, congregation_id: ctx.congreId ?? null })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ group: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
