import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    let query = sb().from('maintenance_tasks').select('*').order('sort_order', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const body = await request.json();
    const { data, error } = await sb()
      .from('maintenance_tasks')
      .insert({ title: body.title, category: body.category || null, link: body.link || null, description: body.description || null, done: body.done ?? false, assigned_to: body.assigned_to || [], sort_order: body.sort_order || 0, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
