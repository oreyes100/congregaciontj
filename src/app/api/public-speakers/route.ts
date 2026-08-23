import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    let query = supabase.from('public_speakers').select('*').order('congregation', { ascending: true }).order('name', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ speakers: data || [] });
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
    const { name, congregation, city, phone, email, outline_numbers, notes } = body;
    if (!name || !congregation) return NextResponse.json({ error: 'name and congregation required' }, { status: 400 });

    const { data, error } = await supabase
      .from('public_speakers')
      .insert({ name: String(name).trim(), congregation: String(congregation).trim(), city: city || null, phone: phone || null, email: email || null, outline_numbers: Array.isArray(outline_numbers) ? outline_numbers.map(Number) : [], notes: notes || null, congregation_id: ctx.congreId ?? null })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ speaker: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
