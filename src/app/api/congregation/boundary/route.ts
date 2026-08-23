import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    if (!ctx.congreId && !ctx.isSuperAdmin) return NextResponse.json({ boundary: null });
    const db = getDb();
    const row = db.prepare(`SELECT boundary FROM congregations WHERE id = ? LIMIT 1`)
      .get(ctx.congreId) as { boundary: string | null } | undefined;
    const boundary = row?.boundary ? JSON.parse(row.boundary) : null;
    return NextResponse.json({ boundary });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    if (!ctx.congreId && !ctx.isSuperAdmin) return NextResponse.json({ error: 'No congregation' }, { status: 403 });
    const body = await request.json();
    // body.boundary: LatLng[] | null
    const value = body.boundary ? JSON.stringify(body.boundary) : null;
    const db = getDb();
    db.prepare(`UPDATE congregations SET boundary = ? WHERE id = ?`).run(value, ctx.congreId);
    return NextResponse.json({ success: true, boundary: body.boundary ?? null });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
