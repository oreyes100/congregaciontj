import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


const SCHEMA_ERROR_CODES = new Set(['PGRST200', '42P01', '42703', 'PGRST204']);
function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code !== undefined && SCHEMA_ERROR_CODES.has(error.code)) ||
    (typeof error.message === 'string' && (error.message.includes('does not exist') || error.message.includes('relation') || error.message.includes('schema cache')))
  );
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();

    let query = supabase.from('territories').select('*').order('number', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query;
    if (error) {
      if (isSchemaMissing(error)) return NextResponse.json({ territories: [], migration_applied: false });
      throw error;
    }

    const ids = Array.from(new Set((data || []).map((t: any) => t.assigned_to).filter(Boolean)));
    const namesById: Record<string, string> = {};
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
      for (const u of users || []) namesById[u.id] = u.name;
    }

    const territories = (data || []).map((t: any) => ({ ...t, assigned_name: t.assigned_to ? namesById[t.assigned_to] || null : null }));
    return NextResponse.json({ territories, migration_applied: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch territories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();

    const insert = {
      id: crypto.randomUUID(),
      number: body.number ?? null,
      name: body.name,
      color: body.color || '#3d7d8e',
      coordinates: body.coordinates || [],
      group_name: body.group_name ?? null,
      assigned_to: body.assigned_to ?? null,
      visit_start: body.visit_start ?? null,
      visit_end: body.visit_end ?? null,
      note: body.note ?? null,
      status: body.status || 'available',
      pairs_count: body.pairs_count ?? null,
      congregation_id: ctx.congreId ?? null,
    };

    const { data, error } = await supabase.from('territories').insert([insert]).select().single();
    if (error) {
      if (isSchemaMissing(error)) return NextResponse.json({ error: 'Tabla territories no existe. Ejecuta sql/territories_schema.sql en Supabase.', migration_applied: false }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ territory: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
