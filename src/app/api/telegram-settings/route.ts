import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getTelegramSettings } from '@/lib/telegram';

const EDITABLE = [
  'telegram_enabled', 'telegram_bot_token', 'telegram_chat_id',
  'telegram_notify_on_assign', 'telegram_notify_overdue',
  'telegram_notify_weekly_status', 'telegram_weekly_dow',
] as const;

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const s = getTelegramSettings(ctx.congreId ?? null);
    const { telegram_bot_token, ...safe } = s;
    return NextResponse.json({ settings: { ...safe, has_bot_token: Boolean(telegram_bot_token) } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const body = await request.json() as Record<string, unknown>;
    const congreId = ctx.congreId ?? null;

    const existing = congreId
      ? db.prepare(`SELECT congregation_id FROM messaging_settings WHERE congregation_id = ?`).get(congreId)
      : db.prepare(`SELECT congregation_id FROM messaging_settings WHERE congregation_id IS NULL`).get();

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      if (key === 'telegram_bot_token' && !body[key]) continue;
      sets.push(`${key} = ?`);
      const v = body[key];
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v ?? null);
    }

    if (existing) {
      if (sets.length) {
        sets.push(`updated_at = ?`);
        vals.push(new Date().toISOString());
        if (congreId) {
          db.prepare(`UPDATE messaging_settings SET ${sets.join(', ')} WHERE congregation_id = ?`).run(...vals, congreId);
        } else {
          db.prepare(`UPDATE messaging_settings SET ${sets.join(', ')} WHERE congregation_id IS NULL`).run(...vals);
        }
      }
    } else {
      const cols = ['congregation_id', ...sets.map(s => s.split(' = ')[0])];
      db.prepare(
        `INSERT INTO messaging_settings (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
      ).run(congreId, ...vals);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
