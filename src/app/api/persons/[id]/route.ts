import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

const PERSON_FIELDS = `
  id,
  first_name, middle_name, last_name, suffix, display_name,
  phone1, phone2, address, lat_lng, email1, email2,
  gender, date_of_birth, family_id, is_family_head, notes,
  status, moved_date, moved_to_congregation, is_active,
  is_publisher, is_unbaptized_publisher, is_elder, is_ministerial_servant,
  is_regular_pioneer, is_auxiliary_pioneer, is_special_pioneer, auxiliary_pioneer_this_month,
  can_be_chairman, can_be_speaker, speaker_local, speaker_visiting, can_do_gems, can_do_bible_reading,
  can_do_student_parts, can_be_assistant, can_do_prayers,
  can_be_cbs_conductor, can_be_cbs_reader,
  is_elderly, is_infirm, is_child, is_deaf, is_blind, is_anointed,
  has_kh_key, is_ldc_volunteer, reports_directly_to_branch,
  custom_information, custom_spiritual_1, custom_spiritual_2, custom_spiritual_3,
  custom_spiritual_4, custom_spiritual_5, custom_spiritual_6,
  disable_app_access, available_start, available_end
`;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    try {
      let query = supabase.from('users').select(PERSON_FIELDS).eq('id', id);
      if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
      const { data, error } = await query.single();
      if (error) throw error;
      return NextResponse.json({ person: data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      console.warn('Person [id] full fetch failed, using legacy fallback:', msg);
      let query = supabase
        .from('users')
        .select('id, name, email, available_start, available_end')
        .eq('id', id);
      if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
      const { data, error } = await query.single();
      if (error) throw error;
      return NextResponse.json({ person: { ...data, migrationPending: true } });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch person';
    console.error('GET /api/persons/[id] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    const body = await request.json();

    const first_name = (body.first_name || '').trim();
    if (!first_name) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    const last_name = (body.last_name || '').trim() || null;
    const display_name = [first_name, body.middle_name, last_name, body.suffix]
      .filter(Boolean).join(' ').trim() || null;

    const update: Record<string, unknown> = {
      first_name,
      middle_name: body.middle_name || null,
      last_name,
      suffix: body.suffix || null,
      display_name,
      phone1: body.phone1 || null,
      phone2: body.phone2 || null,
      address: body.address || null,
      lat_lng: body.lat_lng || null,
      email1: body.email1 || body.email || null,
      email2: body.email2 || null,
      gender: body.gender || 'male',
      date_of_birth: body.date_of_birth || null,
      is_family_head: body.is_family_head || false,
      notes: body.notes || null,
      status: body.status || 'active',
      is_active: body.is_active ?? !(body.status === 'removed' || body.status === 'moved'),
      is_publisher: body.is_publisher ?? true,
      is_unbaptized_publisher: body.is_unbaptized_publisher || false,
      is_elder: body.is_elder || false,
      is_ministerial_servant: body.is_ministerial_servant || false,
      is_regular_pioneer: body.is_regular_pioneer || false,
      is_auxiliary_pioneer: body.is_auxiliary_pioneer || false,
      is_special_pioneer: body.is_special_pioneer || false,
      auxiliary_pioneer_this_month: body.auxiliary_pioneer_this_month || false,
      can_be_chairman: body.can_be_chairman ?? false,
      can_be_speaker: body.can_be_speaker ?? body.gender === 'male',
      speaker_local: body.speaker_local ?? true,
      speaker_visiting: body.speaker_visiting ?? false,
      can_do_gems: body.can_do_gems ?? body.gender === 'male',
      can_do_bible_reading: body.can_do_bible_reading ?? true,
      can_do_student_parts: body.can_do_student_parts ?? true,
      can_be_assistant: body.can_be_assistant ?? true,
      can_do_prayers: body.can_do_prayers ?? body.gender === 'male',
      can_be_cbs_conductor: body.can_be_cbs_conductor ?? body.gender === 'male',
      can_be_cbs_reader: body.can_be_cbs_reader ?? body.gender === 'male',
      is_elderly: body.is_elderly || false,
      is_infirm: body.is_infirm || false,
      is_child: body.is_child || false,
      is_deaf: body.is_deaf || false,
      is_blind: body.is_blind || false,
      is_anointed: body.is_anointed || false,
      has_kh_key: body.has_kh_key || false,
      is_ldc_volunteer: body.is_ldc_volunteer || false,
      reports_directly_to_branch: body.reports_directly_to_branch || false,
      custom_information: body.custom_information || false,
      custom_spiritual_1: body.custom_spiritual_1 || false,
      custom_spiritual_2: body.custom_spiritual_2 || false,
      custom_spiritual_3: body.custom_spiritual_3 || false,
      custom_spiritual_4: body.custom_spiritual_4 || false,
      custom_spiritual_5: body.custom_spiritual_5 || false,
      custom_spiritual_6: body.custom_spiritual_6 || false,
      disable_app_access: body.disable_app_access || false,
      moved_date: body.moved_date || null,
      moved_to_congregation: body.moved_to_congregation || null,
      name: display_name || first_name,
      email: body.email || (first_name ? `${first_name.toLowerCase()}.${id.slice(0, 6)}@placeholder.local` : null),
    };

    if (body.status === 'moved' && !body.moved_date) {
      update.moved_date = new Date().toISOString().split('T')[0];
    }

    const addCongreFilter = (q: any) => {
      if (ctx.congreId && !ctx.isSuperAdmin) return q.eq('congregation_id', ctx.congreId);
      return q;
    };

    try {
      const { data, error } = await addCongreFilter(
        supabase.from('users').update(update).eq('id', id)
      ).select().single();
      if (error) throw error;
      return NextResponse.json({ person: data });
    } catch (e: unknown) {
      console.warn('Person full update failed, using legacy fallback. Raw error:', e);
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg.includes('speaker_local') || msg.includes('speaker_visiting')) {
        const u2 = { ...update };
        delete (u2 as Record<string, unknown>).speaker_local;
        delete (u2 as Record<string, unknown>).speaker_visiting;
        const { data, error } = await addCongreFilter(
          supabase.from('users').update(u2).eq('id', id)
        ).select().single();
        if (!error) return NextResponse.json({ person: data, migrationPending: true });
      }
      const legacyUpdate = {
        name: display_name || first_name,
        email: body.email || `${first_name.toLowerCase()}.${id.slice(0, 6)}@placeholder.local`,
      };
      const { data, error } = await addCongreFilter(
        supabase.from('users').update(legacyUpdate).eq('id', id)
      ).select().single();
      if (error) throw error;
      return NextResponse.json({ person: data, migrationPending: true });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update person';
    console.error('PUT /api/persons/[id] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();

    if (ctx.congreId && !ctx.isSuperAdmin) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .eq('congregation_id', ctx.congreId)
        .maybeSingle();
      if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [meetings, parts] = await Promise.all([
      supabase.from('meetings').select('id').or(`chairman_id.eq.${id},opening_prayer_id.eq.${id},closing_prayer_id.eq.${id},cbs_conductor_id.eq.${id},cbs_reader_id.eq.${id}`),
      supabase.from('meeting_parts').select('id').or(`assigned_user_id.eq.${id},assistant_user_id.eq.${id}`),
    ]);

    const meetingCount = meetings.data?.length || 0;
    const partCount = parts.data?.length || 0;

    if (meetingCount > 0 || partCount > 0) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ status: 'removed', is_active: false, is_publisher: false })
          .eq('id', id);
        if (error) throw error;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'unknown';
        console.warn('Soft delete full update failed, using legacy fallback:', msg);
        const { error } = await supabase
          .from('users')
          .update({ is_active: false, is_publisher: false })
          .eq('id', id);
        if (error) throw error;
      }
      return NextResponse.json({
        ok: true,
        soft: true,
        message: `Person is referenced in ${meetingCount} meetings and ${partCount} parts; marked as removed.`,
      });
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true, soft: false });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to delete person';
    console.error('DELETE /api/persons/[id] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
