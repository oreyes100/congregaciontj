import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

function joinAssignment(row: Record<string, unknown>) {
  const { u_id, u_first_name, u_last_name, u_name, s_id, s_location_id, s_day_of_week, s_start_time, s_end_time, s_persons_needed, ...rest } = row;
  return {
    ...rest,
    user: u_id ? { id: u_id, first_name: u_first_name, last_name: u_last_name, name: u_name } : null,
    shift: s_id ? { id: s_id, location_id: s_location_id, day_of_week: s_day_of_week, start_time: s_start_time, end_time: s_end_time, persons_needed: s_persons_needed } : null,
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { searchParams } = new URL(request.url);
    const weekDate = searchParams.get('week');
    const db = getDb();

    let sql = `SELECT a.*,
      u.id as u_id, u.first_name as u_first_name, u.last_name as u_last_name, u.name as u_name,
      s.id as s_id, s.location_id as s_location_id, s.day_of_week as s_day_of_week,
      s.start_time as s_start_time, s.end_time as s_end_time, s.persons_needed as s_persons_needed
      FROM pw_assignments a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN pw_shifts s ON s.id = a.shift_id`;
    const params: unknown[] = [];
    if (weekDate) { sql += ' WHERE a.week_date = ?'; params.push(weekDate); }

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return NextResponse.json({ assignments: rows.map(joinAssignment) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch assignments';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const body = await request.json();
    const id = crypto.randomUUID();
    const { error } = await sb().from('pw_assignments').insert({ id, shift_id: body.shift_id, week_date: body.week_date, user_id: body.user_id });
    if (error) throw error;
    const db = getDb();
    const row = db.prepare(`SELECT a.*, u.id as u_id, u.first_name as u_first_name, u.last_name as u_last_name, u.name as u_name, s.id as s_id, s.location_id as s_location_id, s.day_of_week as s_day_of_week, s.start_time as s_start_time, s.end_time as s_end_time, s.persons_needed as s_persons_needed FROM pw_assignments a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN pw_shifts s ON s.id = a.shift_id WHERE a.id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Insert failed');
    return NextResponse.json({ assignment: joinAssignment(row) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create assignment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await sb().from('pw_assignments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete assignment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
