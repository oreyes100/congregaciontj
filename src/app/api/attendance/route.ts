import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase.from('meeting_attendance').select('*').order('meeting_date', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    if (from) query = query.gte('meeting_date', from);
    if (to) query = query.lte('meeting_date', to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();
    const payload = {
      meeting_date: body.meeting_date,
      meeting_type: body.meeting_type,
      in_person: body.in_person === '' || body.in_person == null ? null : Number(body.in_person),
      online: body.online === '' || body.online == null ? null : Number(body.online),
      updated_at: new Date().toISOString(),
      congregation_id: ctx.congreId ?? null,
    };
    const { data, error } = await supabase
      .from('meeting_attendance')
      .upsert(payload, { onConflict: 'meeting_date,meeting_type,congregation_id' })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
