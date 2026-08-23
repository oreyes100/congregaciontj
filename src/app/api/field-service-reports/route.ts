import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const userId = searchParams.get('user_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase.from('field_service_reports').select('*').order('month', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    if (month) query = query.eq('month', month);
    if (userId) query = query.eq('user_id', userId);
    if (from) query = query.gte('month', from);
    if (to) query = query.lte('month', to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ reports: data || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch field service reports';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    if (!body.user_id || !body.month) return NextResponse.json({ error: 'user_id and month are required' }, { status: 400 });

    const { data, error } = await supabase
      .from('field_service_reports')
      .upsert({
        user_id: body.user_id,
        month: body.month,
        participated: body.participated ?? false,
        is_auxiliary_pioneer: body.is_auxiliary_pioneer ?? false,
        hours: body.hours ?? null,
        bible_studies: body.bible_studies ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
        congregation_id: ctx.congreId ?? null,
      }, { onConflict: 'user_id,month' })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to save report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
