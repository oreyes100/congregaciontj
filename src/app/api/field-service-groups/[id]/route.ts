import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { id } = await params;
    const body = await request.json();

    if (body.group) {
      let query = supabase
        .from('field_service_groups')
        .update({
          name: body.group.name,
          meeting_day: body.group.meeting_day,
          meeting_time: body.group.meeting_time,
          meeting_location: body.group.meeting_location,
          sort_order: body.group.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
      const { error } = await query;
      if (error) throw error;
    }

    if (body.members) {
      await supabase.from('field_service_group_members').delete().eq('group_id', id);

      if (body.members.length > 0) {
        const rows = body.members.map((m: any, i: number) => ({
          group_id: id,
          user_id: m.user_id,
          role: m.role || 'member',
          sort_order: i,
        }));
        const { error: mErr } = await supabase.from('field_service_group_members').insert(rows);
        if (mErr) throw mErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { id } = await params;

    let query = supabase.from('field_service_groups').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
