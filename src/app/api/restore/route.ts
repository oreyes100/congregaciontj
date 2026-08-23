import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { ALL_TABLES, primaryKeyOf } from '@/lib/backupSections';
import { parseCsv } from '@/lib/csv';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

const CHUNK_SIZE = 500;

const TABLES_WITH_CONGREGATION_ID = new Set([
  'meetings', 'weekend_meetings', 'field_service_groups', 'field_service_meetings',
  'field_service_reports', 'territories', 'public_speakers', 'outgoing_talks',
  'pw_locations', 'congregation_tasks', 'cleaning_assignments', 'maintenance_tasks',
  'circuit_overseer_visits', 'memorial_roles', 'congregation_events', 'congregation_roles',
  'meeting_attendance', 'users',
]);

function coerce(value: string): unknown {
  if (value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function writeTable(table: string, rows: Record<string, unknown>[], mode: 'merge' | 'replace', congregationId?: string | null) {
  if (!ALL_TABLES.includes(table)) throw new Error(`Tabla no reconocida: ${table}`);
  const supabase = sb();
  const pk = primaryKeyOf(table);

  if (congregationId && TABLES_WITH_CONGREGATION_ID.has(table)) {
    for (const row of rows) {
      row.congregation_id = congregationId;
    }
  }

  if (mode === 'replace') {
    let delQuery = supabase.from(table).delete().not(pk, 'is', null);
    if (congregationId && TABLES_WITH_CONGREGATION_ID.has(table)) {
      delQuery = delQuery.eq('congregation_id', congregationId);
    }
    const { error } = await delQuery;
    if (error) throw new Error(`${table} (borrado): ${error.message}`);
  }
  if (rows.length === 0) return { table, rows: 0 };

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = mode === 'replace'
      ? await supabase.from(table).insert(batch)
      : await supabase.from(table).upsert(batch, { onConflict: pk });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return { table, rows: rows.length };
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const congreId = ctx.congreId && !ctx.isSuperAdmin ? ctx.congreId : null;

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const mode = (form.get('mode') as string) === 'replace' ? 'replace' : 'merge';
    const confirm = (form.get('confirm') as string) || '';
    const targetTable = (form.get('table') as string) || '';

    if (!file) return NextResponse.json({ error: 'Falta el archivo de respaldo' }, { status: 400 });
    if (mode === 'replace' && confirm !== 'CONFIRMAR') {
      return NextResponse.json({ error: 'El modo de reemplazo total requiere escribir CONFIRMAR' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const text = await file.text();
    const results: { table: string; rows: number }[] = [];

    if (name.endsWith('.json')) {
      const dump = JSON.parse(text) as Record<string, Record<string, unknown>[]>;
      for (const table of Object.keys(dump)) {
        if (!ALL_TABLES.includes(table)) continue;
        results.push(await writeTable(table, dump[table], mode, congreId));
      }
    } else if (name.endsWith('.csv')) {
      if (!targetTable) return NextResponse.json({ error: 'Selecciona a qué tabla corresponde el CSV' }, { status: 400 });
      const rawRows = parseCsv(text);
      const rows = rawRows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, coerce(v)])));
      results.push(await writeTable(targetTable, rows, mode, congreId));
    } else {
      return NextResponse.json({ error: 'Formato no soportado — sube un .json o .csv' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Restore failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
