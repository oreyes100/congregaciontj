import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

/** Inbox for the signed-in user, newest first. `?all=1` returns the congregation log. */
export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const all = new URL(request.url).searchParams.get('all') === '1';

    const rows = all
      ? db.prepare(`
          SELECT m.*, u.name AS user_name FROM messages m
          LEFT JOIN users u ON u.id = m.user_id
          WHERE m.congregation_id IS ? ORDER BY m.created_at DESC LIMIT 200
        `).all(ctx.congreId ?? null)
      : db.prepare(`
          SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
        `).all(ctx.userId);

    const unread = db.prepare(
      `SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND read_at IS NULL`
    ).get(ctx.userId) as { n: number };

    return NextResponse.json({ messages: rows, unread: unread.n });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

/** Mark messages read. Body: { ids: string[] } or { all: true }. */
export async function PATCH(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const body = await request.json();
    const now = new Date().toISOString();

    if (body.all) {
      db.prepare(`UPDATE messages SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(now, ctx.userId);
    } else if (Array.isArray(body.ids) && body.ids.length) {
      const ph = body.ids.map(() => '?').join(',');
      db.prepare(`UPDATE messages SET read_at = ? WHERE user_id = ? AND id IN (${ph})`)
        .run(now, ctx.userId, ...body.ids);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
