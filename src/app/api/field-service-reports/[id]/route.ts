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
      .from('field_service_reports')
      .update({
        participated: body.participated ?? false,
        is_auxiliary_pioneer: body.is_auxiliary_pioneer ?? false,
        hours: body.hours ?? null,
        bible_studies: body.bible_studies ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { id } = await params;

    let query = supabase.from('field_service_reports').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
