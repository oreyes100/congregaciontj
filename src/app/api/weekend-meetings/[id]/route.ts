import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

const ALLOWED = [
  'speaker_type', 'local_speaker_id', 'visiting_speaker_id', 'other_speaker_name',
  'outline_id', 'special_talk_title', 'song', 'speaker_confirmed', 'notes',
  'chairman_id', 'wt_conductor_id', 'wt_reader_id',
  'hospitality_person_id', 'hospitality_text', 'cleaning_group',
];

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ALLOWED) {
      if (k in body) updates[k] = body[k];
    }

    if (updates.outline_id) {
      const { data: wm } = await supabase
        .from('weekend_meetings')
        .select('date, outline_id')
        .eq('id', id)
        .single();

      if (wm && wm.outline_id !== updates.outline_id) {
        let speakerName: string | null = null;
        const speakerType = updates.speaker_type || body.speaker_type;
        if (speakerType === 'visiting' && updates.visiting_speaker_id) {
          const { data: sp } = await supabase.from('public_speakers').select('name').eq('id', updates.visiting_speaker_id).single();
          speakerName = ((sp as any)?.name as string) ?? null;
        } else if (speakerType === 'local' && updates.local_speaker_id) {
          const { data: p } = await supabase.from('users').select('first_name, last_name, display_name, name').eq('id', updates.local_speaker_id).single();
          const pr = p as any;
          speakerName = pr ? (pr.display_name || [pr.first_name, pr.last_name].filter(Boolean).join(' ') || pr.name || '').trim() : null;
        }

        await supabase.from('public_talk_history').insert({
          outline_id: updates.outline_id,
          date: wm.date,
          speaker_name: speakerName,
        });
      }
    }

    let query = supabase
      .from('weekend_meetings')
      .update(updates)
      .eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query
      .select(`
        *,
        outline:public_talk_outlines(*),
        local_speaker:users!weekend_meetings_local_speaker_id_fkey(id, first_name, last_name, display_name, name),
        visiting_speaker:public_speakers!weekend_meetings_visiting_speaker_id_fkey(*),
        chairman:users!weekend_meetings_chairman_id_fkey(id, first_name, last_name, display_name, name),
        wt_conductor:users!weekend_meetings_wt_conductor_id_fkey(id, first_name, last_name, display_name, name),
        wt_reader:users!weekend_meetings_wt_reader_id_fkey(id, first_name, last_name, display_name, name),
        hospitality_person:users!weekend_meetings_hospitality_person_id_fkey(id, first_name, last_name, display_name, name)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ meeting: data });
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
    let query = supabase.from('weekend_meetings').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
