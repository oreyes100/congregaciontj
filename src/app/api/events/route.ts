import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    let query = sb().from('congregation_events').select('*').order('start_date', { ascending: true });
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
      .from('congregation_events')
      .insert({ type: body.type || null, name: body.name || null, description: body.description || null, link: body.link || null, start_date: body.start_date || null, end_date: body.end_date || null, single_day: body.single_day ?? false, show_start_time: body.show_start_time ?? false, show_end_time: body.show_end_time ?? false, group_name: body.group_name || null, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
