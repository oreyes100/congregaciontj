import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { searchParams } = new URL(request.url);
    const weekDate = searchParams.get('week');
    const db = getDb();

    let sql = `
      SELECT m.*,
        c.id as c_id, c.first_name as c_first, c.last_name as c_last, c.name as c_name,
        z.id as z_id, z.first_name as z_first, z.last_name as z_last, z.name as z_name,
        g.id as g_id, g.name as g_name
      FROM field_service_meetings m
      LEFT JOIN users c ON c.id = m.conductor_id
      LEFT JOIN users z ON z.id = m.zoom_host_id
      LEFT JOIN field_service_groups g ON g.id = m.group_id
    `;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (ctx.congreId) { conds.push('m.congregation_id = ?'); params.push(ctx.congreId); }
    if (weekDate) { conds.push('m.week_date = ?'); params.push(weekDate); }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ' ORDER BY m.meeting_time ASC';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const meetings = rows.map(m => {
      const { c_id, c_first, c_last, c_name, z_id, z_first, z_last, z_name, g_id, g_name, ...rest } = m;
      return {
        ...rest,
        conductor: c_id ? { id: c_id, first_name: c_first, last_name: c_last, name: c_name } : null,
        zoom_host: z_id ? { id: z_id, first_name: z_first, last_name: z_last, name: z_name } : null,
        group: g_id ? { id: g_id, name: g_name } : null,
      };
    });
    return NextResponse.json({ meetings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch field service meetings';
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
      .from('field_service_meetings')
      .insert({ week_date: body.week_date, day_of_week: body.day_of_week, time_period: body.time_period || 'am', meeting_time: body.meeting_time || null, location: body.location || null, conductor_id: body.conductor_id || null, zoom_host_id: body.zoom_host_id || null, territory: body.territory || null, notes: body.notes || null, group_id: body.group_id || null, cart_count: body.cart_count || 0, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ meeting: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
