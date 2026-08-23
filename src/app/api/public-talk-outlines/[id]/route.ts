import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

// TODO: public_talk_outlines table needs congregation_id column before filtering can be applied
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.number !== undefined) updates.number = Number(body.number);
    if (body.title !== undefined) updates.title = String(body.title).trim();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('public_talk_outlines')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ outline: data });
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

    const { error } = await supabase
      .from('public_talk_outlines')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
