import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

// TODO: public_talk_outlines table needs congregation_id column before filtering can be applied
export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();

    const { data: outlines, error } = await supabase
      .from('public_talk_outlines')
      .select('*')
      .order('number', { ascending: true });

    if (error) throw error;

    const { data: history } = await supabase
      .from('public_talk_history')
      .select('outline_id, date, speaker_name')
      .order('date', { ascending: false });

    const lastGiven: Record<string, { date: string; speaker: string | null }> = {};
    for (const h of history || []) {
      if (!lastGiven[h.outline_id]) {
        lastGiven[h.outline_id] = { date: h.date, speaker: h.speaker_name };
      }
    }

    const enriched = (outlines || []).map((o: any) => ({
      ...o,
      last_given_date: lastGiven[o.id]?.date ?? null,
      last_given_speaker: lastGiven[o.id]?.speaker ?? null,
    }));

    return NextResponse.json({ outlines: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const body = await request.json();
    const { number, title } = body;

    if (!number || !title) {
      return NextResponse.json({ error: 'number and title required' }, { status: 400 });
    }

    const { data, error } = await sb()
      .from('public_talk_outlines')
      .insert({ number: Number(number), title: String(title).trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ outline: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
