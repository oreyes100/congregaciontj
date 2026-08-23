import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getMessagingSettings, DEFAULT_TEMPLATES } from '@/lib/messaging';

/** Fields the congregation admin may edit. */
const EDITABLE = [
  'whatsapp_enabled', 'provider', 'phone_number_id', 'access_token', 'sender_label',
  'notify_on_assign', 'notify_overdue', 'overdue_days',
  'notify_weekly_status', 'weekly_status_dow',
  'template_assign', 'template_overdue', 'template_weekly',
] as const;

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const s = getMessagingSettings(ctx.congreId ?? null);
    // Never leak the token back to the browser — only whether one is stored.
    const { access_token, ...safe } = s;
    return NextResponse.json({
      settings: { ...safe, has_access_token: Boolean(access_token) },
      defaults: DEFAULT_TEMPLATES,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const body = await request.json();
    const congreId = ctx.congreId ?? null;

    const existing = congreId
      ? db.prepare(`SELECT congregation_id FROM messaging_settings WHERE congregation_id = ?`).get(congreId)
      : db.prepare(`SELECT congregation_id FROM messaging_settings WHERE congregation_id IS NULL`).get();

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      // An empty access_token means "leave the stored one alone".
      if (key === 'access_token' && !body[key]) continue;
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
