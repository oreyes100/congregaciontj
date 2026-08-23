import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

const ALLOWED = [
  'name', 'number', 'congregation_id', 'language', 'time_zone',
  'weekend_meeting_day', 'weekend_meeting_time', 'midweek_meeting_day', 'midweek_meeting_time',
  'zoom_meeting_id', 'zoom_password', 'zoom_link', 'dial_in_number',
  'kingdom_hall_address', 'circuit', 'co_name', 'co_contact_details', 'auxiliary_rooms',
  'field_service_group_count',
];

async function syncFieldServiceGroupCount(supabase: any, count: number) {
  if (!count || count < 1) return;
  const { data: groups } = await supabase
    .from('field_service_groups')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });
  const existing = groups || [];
  if (existing.length >= count) return;
  const usedNames = new Set(existing.map((g: any) => g.name));
  const toInsert = [];
  let sortOrder = existing.length;
  for (let i = 1; i <= count && existing.length + toInsert.length < count; i++) {
    const name = `Grupo ${i}`;
    if (usedNames.has(name)) continue;
    toInsert.push({ name, sort_order: sortOrder++ });
  }
  if (toInsert.length) await supabase.from('field_service_groups').insert(toInsert);
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const client = sb();
    let query = client.from('congregation_settings').select('*').order('created_at', { ascending: true }).limit(1);
    if (ctx.congreId) query = query.eq('owning_congregation_id', ctx.congreId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return NextResponse.json({ congregation: data || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
      : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ALLOWED) if (k in body) updates[k] = body[k];

    let q = supabase.from('congregation_settings').select('id').order('created_at', { ascending: true }).limit(1);
    if (ctx.congreId) q = q.eq('owning_congregation_id', ctx.congreId);
    const { data: existing } = await q.maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('congregation_settings')
        .update(updates)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single();
      if (error) throw error;
      if (updates.field_service_group_count) await syncFieldServiceGroupCount(supabase, updates.field_service_group_count as number);
      return NextResponse.json({ congregation: data });
    }

    if (ctx.congreId) updates.owning_congregation_id = ctx.congreId;
    const { data, error } = await supabase
      .from('congregation_settings')
      .insert(updates)
      .select()
      .single();
    if (error) throw error;
    if (updates.field_service_group_count) await syncFieldServiceGroupCount(supabase, updates.field_service_group_count as number);
    return NextResponse.json({ congregation: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
      : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
