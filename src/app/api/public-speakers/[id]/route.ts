import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    const body = await request.json();
    const allowed = ['name', 'congregation', 'city', 'phone', 'email', 'outline_numbers', 'notes'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in body) updates[k] = k === 'outline_numbers' ? (body[k] || []).map(Number) : body[k];
    }

    let query = supabase
      .from('public_speakers')
      .update(updates)
      .eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ speaker: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    let query = supabase.from('public_speakers').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
