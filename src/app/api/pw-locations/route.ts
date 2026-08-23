import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();

    let locQuery = supabase.from('pw_locations').select('*').order('sort_order', { ascending: true });
    if (ctx.congreId) locQuery = locQuery.eq('congregation_id', ctx.congreId);
    const { data: locations, error } = await locQuery;
    if (error) throw error;

    const locIds = (locations || []).map((l: any) => l.id);
    let shifts: any[] = [];
    if (locIds.length) {
      const { data: sData, error: sErr } = await supabase.from('pw_shifts').select('*').in('location_id', locIds).order('sort_order', { ascending: true });
      if (sErr) throw sErr;
      shifts = sData || [];
    }

    const shiftsByLocation: Record<string, any[]> = {};
    for (const s of shifts) {
      if (!shiftsByLocation[s.location_id]) shiftsByLocation[s.location_id] = [];
      shiftsByLocation[s.location_id].push(s);
    }

    const result = (locations || []).map((l: any) => ({ ...l, shifts: shiftsByLocation[l.id] || [] }));
    return NextResponse.json({ locations: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch locations';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    const { data: loc, error } = await supabase
      .from('pw_locations')
      .insert({ cart_number: body.cart_number || 1, name: body.name || 'New Location', address: body.address || null, map_link: body.map_link || null, notes: body.notes || null, sort_order: body.sort_order || 0, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (error) throw error;
    if (!loc) throw new Error('Insert failed');

    if (body.shifts?.length) {
      const rows = body.shifts.map((s: any, i: number) => ({ location_id: (loc as any).id, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, persons_needed: s.persons_needed || 2, sort_order: i }));
      await supabase.from('pw_shifts').insert(rows);
    }

    return NextResponse.json({ location: { ...loc, shifts: [] } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
