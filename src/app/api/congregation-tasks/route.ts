import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    let query = supabase.from('congregation_tasks').select('*').order('week_date', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    if (week) query = query.eq('week_date', week);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ tasks: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    const { data, error } = await supabase
      .from('congregation_tasks')
      .upsert({ week_date: body.week_date, assignments: body.assignments, updated_at: new Date().toISOString(), congregation_id: ctx.congreId ?? null }, { onConflict: 'week_date,congregation_id' })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
