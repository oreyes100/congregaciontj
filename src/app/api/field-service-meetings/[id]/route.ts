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

    let query = supabase
      .from('field_service_meetings')
      .update({
        day_of_week: body.day_of_week,
        time_period: body.time_period,
        meeting_time: body.meeting_time,
        location: body.location,
        conductor_id: body.conductor_id || null,
        zoom_host_id: body.zoom_host_id || null,
        territory: body.territory,
        notes: body.notes,
        group_id: body.group_id || null,
        cart_count: body.cart_count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { id } = await params;

    let query = supabase.from('field_service_meetings').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
