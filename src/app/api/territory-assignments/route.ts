import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { randomUUID } from 'crypto';

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();

  const { searchParams } = new URL(request.url);
  const territoryId = searchParams.get('territory_id');

  const db = getDb();
  let sql = `SELECT * FROM territory_assignments WHERE 1=1`;
  const params: unknown[] = [];

  if (territoryId) { sql += ` AND territory_id = ?`; params.push(territoryId); }
  if (ctx.congreId) { sql += ` AND congregation_id = ?`; params.push(ctx.congreId); }
  sql += ` ORDER BY created_at ASC`;

  const rows = db.prepare(sql).all(...params);
  return NextResponse.json({ assignments: rows });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();

  const body = await request.json();
  const { territory_id, assigned_name, assigned_date, completed_date } = body;
  if (!territory_id || !assigned_name) {
    return NextResponse.json({ error: 'territory_id and assigned_name required' }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO territory_assignments (id, territory_id, assigned_name, assigned_date, completed_date, congregation_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, territory_id, assigned_name, assigned_date ?? null, completed_date ?? null, ctx.congreId ?? null);

  const row = db.prepare(`SELECT * FROM territory_assignments WHERE id = ?`).get(id);
  return NextResponse.json({ assignment: row }, { status: 201 });
}
