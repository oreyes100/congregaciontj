import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import type { Person } from '@/types';


const PERSON_FIELDS = [
  'id',
  'first_name', 'middle_name', 'last_name', 'suffix', 'display_name',
  'phone1', 'phone2', 'address', 'lat_lng', 'email1', 'email2',
  'gender', 'date_of_birth', 'family_id', 'is_family_head', 'notes',
  'status', 'moved_date', 'moved_to_congregation', 'is_active',
  'is_publisher', 'is_unbaptized_publisher', 'is_elder', 'is_ministerial_servant',
  'is_regular_pioneer', 'is_auxiliary_pioneer', 'is_special_pioneer', 'auxiliary_pioneer_this_month',
  'can_be_chairman', 'can_be_speaker', 'speaker_local', 'speaker_visiting', 'can_do_gems', 'can_do_bible_reading',
  'can_do_student_parts', 'can_be_assistant', 'can_do_prayers',
  'can_be_cbs_conductor', 'can_be_cbs_reader',
  'is_elderly', 'is_infirm', 'is_child', 'is_deaf', 'is_blind', 'is_anointed',
  'has_kh_key', 'is_ldc_volunteer', 'reports_directly_to_branch',
  'custom_information', 'custom_spiritual_1', 'custom_spiritual_2', 'custom_spiritual_3',
  'custom_spiritual_4', 'custom_spiritual_5', 'custom_spiritual_6',
  'disable_app_access', 'available_start', 'available_end', 'name', 'email',
].join(',');

export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'everyone';
    const search = (searchParams.get('q') || '').trim();

    try {
      let query = supabase
        .from('users')
        .select(PERSON_FIELDS)
        .order('last_name', { ascending: true, nullsFirst: false })
        .order('first_name', { ascending: true, nullsFirst: false });

      if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
      query = applyFilter(query, filter);

      const { data, error } = await query;
      if (error) throw error;

      const persons = (data || []).map((r: any) => normalize(r as Record<string, unknown>));
      return NextResponse.json({ persons: search ? accentSearch(persons, search) : persons });
    } catch (e: unknown) {
      console.warn('Person full query failed, using legacy fallback. Raw error:', e);
      let legacyQuery = supabase
        .from('users')
        .select('id, name, email, available_start, available_end');
      if (ctx.congreId) legacyQuery = legacyQuery.eq('congregation_id', ctx.congreId);
      legacyQuery = legacyQuery.order('name', { ascending: true });
      if (search) legacyQuery = legacyQuery.ilike('name', `%${search.toLowerCase()}%`);
      const { data, error } = await legacyQuery;
      if (error) throw error;
      return NextResponse.json({
        persons: (data || []).map((r: any) => normalize(r as Record<string, unknown>)),
        migrationPending: true,
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch persons';
    console.error('GET /api/persons error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function accentSearch(persons: Person[], q: string): Person[] {
  const term = deaccent(q);
  return persons.filter(p => {
    const haystack = [p.first_name, p.last_name, p.display_name]
      .filter(Boolean).map(s => deaccent(s!)).join(' ');
    return haystack.includes(term);
  });
}

function normalize(row: Record<string, unknown>): Person {
  const first_name = (row.first_name as string | null) ?? null;
  const last_name = (row.last_name as string | null) ?? null;
  const display_name = (row.display_name as string | null) ?? (row.name as string | null) ?? null;
  const gender = (row.gender as string | null) === 'female' ? 'female' : 'male';
  return {
    id: row.id as string,
    first_name,
    middle_name: (row.middle_name as string | null) ?? null,
    last_name,
    suffix: (row.suffix as string | null) ?? null,
    display_name,
    phone1: (row.phone1 as string | null) ?? null,
    phone2: (row.phone2 as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    lat_lng: (row.lat_lng as string | null) ?? null,
    email1: (row.email1 as string | null) ?? (row.email as string | null) ?? null,
    email2: (row.email2 as string | null) ?? null,
    gender: gender as 'male' | 'female',
    date_of_birth: (row.date_of_birth as string | null) ?? null,
    family_id: (row.family_id as string | null) ?? null,
    is_family_head: !!(row.is_family_head ?? false),
    notes: (row.notes as string | null) ?? null,
    status: ((row.status as string | null) ?? 'active') as 'active' | 'moved' | 'removed',
    moved_date: (row.moved_date as string | null) ?? null,
    moved_to_congregation: (row.moved_to_congregation as string | null) ?? null,
    is_active: !!(row.is_active ?? true),
    is_publisher: !!(row.is_publisher ?? true),
    is_unbaptized_publisher: !!(row.is_unbaptized_publisher ?? false),
    is_elder: !!(row.is_elder ?? false),
    is_ministerial_servant: !!(row.is_ministerial_servant ?? false),
    is_regular_pioneer: !!(row.is_regular_pioneer ?? false),
    is_auxiliary_pioneer: !!(row.is_auxiliary_pioneer ?? false),
    is_special_pioneer: !!(row.is_special_pioneer ?? false),
    auxiliary_pioneer_this_month: !!(row.auxiliary_pioneer_this_month ?? false),
    can_be_chairman: !!(row.can_be_chairman ?? false),
    can_be_speaker: !!(row.can_be_speaker ?? gender === 'male'),
    can_do_gems: !!(row.can_do_gems ?? gender === 'male'),
    can_do_bible_reading: gender === 'female' ? false : !!(row.can_do_bible_reading ?? true),
    can_do_student_parts: !!(row.can_do_student_parts ?? true),
    can_be_assistant: !!(row.can_be_assistant ?? true),
    can_do_prayers: !!(row.can_do_prayers ?? gender === 'male'),
    can_be_cbs_conductor: !!(row.can_be_cbs_conductor ?? gender === 'male'),
    can_be_cbs_reader: !!(row.can_be_cbs_reader ?? gender === 'male'),
    is_elderly: !!(row.is_elderly ?? false),
    is_infirm: !!(row.is_infirm ?? false),
    is_child: !!(row.is_child ?? false),
    is_deaf: !!(row.is_deaf ?? false),
    is_blind: !!(row.is_blind ?? false),
    is_anointed: !!(row.is_anointed ?? false),
    has_kh_key: !!(row.has_kh_key ?? false),
    is_ldc_volunteer: !!(row.is_ldc_volunteer ?? false),
    reports_directly_to_branch: !!(row.reports_directly_to_branch ?? false),
    custom_information: !!(row.custom_information ?? false),
    custom_spiritual_1: !!(row.custom_spiritual_1 ?? false),
    custom_spiritual_2: !!(row.custom_spiritual_2 ?? false),
    custom_spiritual_3: !!(row.custom_spiritual_3 ?? false),
    custom_spiritual_4: !!(row.custom_spiritual_4 ?? false),
    custom_spiritual_5: !!(row.custom_spiritual_5 ?? false),
    custom_spiritual_6: !!(row.custom_spiritual_6 ?? false),
    disable_app_access: !!(row.disable_app_access ?? false),
    available_start: (row.available_start as string | null) ?? null,
    available_end: (row.available_end as string | null) ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(query: any, filter: string): any {
  switch (filter) {
    case 'everyone': return query.neq('status', 'moved');
    case 'families': return query.eq('is_family_head', true).neq('status', 'moved');
    case 'active_publishers': return query.eq('is_active', true).neq('status', 'moved');
    case 'irregular_publishers': return query.eq('is_active', true).eq('is_publisher', true).neq('status', 'moved');
    case 'inactive_publishers': return query.eq('is_active', false).neq('status', 'moved');
    case 'publishers': return query.eq('is_publisher', true).neq('status', 'moved');
    case 'unbaptized_publishers': return query.eq('is_unbaptized_publisher', true).neq('status', 'moved');
    case 'non_publishers': return query.eq('is_publisher', false).eq('is_unbaptized_publisher', false).neq('status', 'moved');
    case 'elders': return query.eq('is_elder', true).neq('status', 'moved');
    case 'ministerial_servants': return query.eq('is_ministerial_servant', true).neq('status', 'moved');
    case 'appointed_brothers': return query.or('is_elder.eq.true,is_ministerial_servant.eq.true').eq('gender', 'male').neq('status', 'moved');
    case 'non_appointed_active_brothers': return query.eq('gender', 'male').eq('is_active', true).eq('is_elder', false).eq('is_ministerial_servant', false).neq('status', 'moved');
    case 'brothers': return query.eq('gender', 'male').neq('status', 'moved');
    case 'sisters': return query.eq('gender', 'female').neq('status', 'moved');
    case 'all_pioneers': return query.or('is_regular_pioneer.eq.true,is_special_pioneer.eq.true,is_auxiliary_pioneer.eq.true,auxiliary_pioneer_this_month.eq.true').neq('status', 'moved');
    case 'special_pioneers': return query.eq('is_special_pioneer', true).neq('status', 'moved');
    case 'regular_pioneers': return query.eq('is_regular_pioneer', true).neq('status', 'moved');
    case 'auxiliary_pioneers': return query.or('is_auxiliary_pioneer.eq.true,auxiliary_pioneer_this_month.eq.true').neq('status', 'moved');
    case 'family_heads': return query.eq('is_family_head', true).neq('status', 'moved');
    case 'elderly': return query.eq('is_elderly', true).neq('status', 'moved');
    case 'children': return query.eq('is_child', true).neq('status', 'moved');
    case 'blind': return query.eq('is_blind', true).neq('status', 'moved');
    case 'deaf': return query.eq('is_deaf', true).neq('status', 'moved');
    case 'anointed': return query.eq('is_anointed', true).neq('status', 'moved');
    case 'ldc_volunteers': return query.eq('is_ldc_volunteer', true).neq('status', 'moved');
    case 'kh_key': return query.eq('has_kh_key', true).neq('status', 'moved');
    case 'custom_spiritual_1': return query.eq('custom_spiritual_1', true).neq('status', 'moved');
    case 'custom_spiritual_2': return query.eq('custom_spiritual_2', true).neq('status', 'moved');
    case 'custom_spiritual_3': return query.eq('custom_spiritual_3', true).neq('status', 'moved');
    case 'custom_spiritual_4': return query.eq('custom_spiritual_4', true).neq('status', 'moved');
    case 'custom_spiritual_5': return query.eq('custom_spiritual_5', true).neq('status', 'moved');
    case 'custom_spiritual_6': return query.eq('custom_spiritual_6', true).neq('status', 'moved');
    case 'reports_directly_to_branch': return query.eq('reports_directly_to_branch', true).neq('status', 'moved');
    case 'removed': return query.eq('status', 'removed');
    case 'moved': return query.eq('status', 'moved');
    default: return query.neq('status', 'moved');
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    const first_name = (body.first_name || '').trim();
    if (!first_name) return NextResponse.json({ error: 'First name is required' }, { status: 400 });

    const last_name = (body.last_name || '').trim() || null;
    const display_name = [first_name, body.middle_name, last_name, body.suffix].filter(Boolean).join(' ').trim() || null;

    const fullInsert = {
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
      status: 'active',
      is_active: true,
      is_publisher: body.is_publisher ?? true,
      is_unbaptized_publisher: body.is_unbaptized_publisher || false,
      is_elder: body.is_elder || false,
      is_ministerial_servant: body.is_ministerial_servant || false,
      is_regular_pioneer: body.is_regular_pioneer || false,
      is_auxiliary_pioneer: body.is_auxiliary_pioneer || false,
      is_special_pioneer: body.is_special_pioneer || false,
      auxiliary_pioneer_this_month: body.auxiliary_pioneer_this_month || false,
      can_be_chairman: body.can_be_chairman ?? body.is_elder ?? false,
      can_be_speaker: body.can_be_speaker ?? body.gender === 'male',
      can_do_gems: body.can_do_gems ?? body.gender === 'male',
      can_do_bible_reading: body.gender === 'female' ? false : (body.can_do_bible_reading ?? true),
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
      name: display_name || first_name,
      email: body.email || `${first_name.toLowerCase()}.${Date.now()}@placeholder.local`,
      congregation_id: ctx.congreId ?? null,
    };

    try {
      const { data, error } = await supabase.from('users').insert(fullInsert).select().single();
      if (error) throw error;
      return NextResponse.json({ person: data });
    } catch (e: unknown) {
      console.warn('Person full insert failed, using legacy fallback. Raw error:', e);
      const legacyEmail = body.email || `${first_name.toLowerCase()}.${Date.now()}@placeholder.local`;
      const { data, error } = await supabase.from('users').insert({ name: display_name || first_name, email: legacyEmail, available_start: null, available_end: null, congregation_id: ctx.congreId ?? null }).select().single();
      if (error) throw error;
      return NextResponse.json({ person: data, migrationPending: true });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create person';
    console.error('POST /api/persons error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
