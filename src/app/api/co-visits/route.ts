import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    let query = sb().from('circuit_overseer_visits').select('*').order('week_date', { ascending: true });
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
      .from('circuit_overseer_visits')
      .insert({ week_date: body.week_date, host_id: body.host_id || null, co_companions: body.co_companions || [], wife_companions: body.wife_companions || [], activities: body.activities || [], notes: body.notes || null, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
