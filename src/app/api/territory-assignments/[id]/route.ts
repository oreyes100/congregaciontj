import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();

  const { id } = await params;
  const body = await request.json();
  const EDITABLE = ['assigned_name', 'assigned_date', 'completed_date'] as const;

  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of EDITABLE) {
    if (k in body) { sets.push(`${k} = ?`); vals.push(body[k] ?? null); }
  }
  if (!sets.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  vals.push(id);
  if (ctx.congreId && !ctx.isSuperAdmin) vals.push(ctx.congreId);
  const guard = ctx.congreId && !ctx.isSuperAdmin ? ` AND congregation_id = ?` : '';
  db.prepare(`UPDATE territory_assignments SET ${sets.join(', ')} WHERE id = ?${guard}`).run(...vals);

  const row = db.prepare(`SELECT * FROM territory_assignments WHERE id = ?`).get(id);
  return NextResponse.json({ assignment: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();

  const { id } = await params;
  const db = getDb();
  const guard = ctx.congreId && !ctx.isSuperAdmin ? ` AND congregation_id = ?` : '';
  const vals: unknown[] = [id];
  if (ctx.congreId && !ctx.isSuperAdmin) vals.push(ctx.congreId);
  db.prepare(`DELETE FROM territory_assignments WHERE id = ?${guard}`).run(...vals);
  return NextResponse.json({ success: true });
}
