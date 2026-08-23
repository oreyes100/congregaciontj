import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext } from '@/lib/serverContext';
import { getMessagingSettings, notify, renderTemplate, DEFAULT_TEMPLATES } from '@/lib/messaging';

/**
 * Sends the two recurring territory reminders:
 *  - overdue: assigned more than `overdue_days` ago and still not finished
 *  - weekly:  a progress request, once per ISO week per assignment
 *
 * Both are deduped via `messages.dedupe_key`, so running this more often than
 * needed is harmless. Intended to be hit by cron; a signed-in user may also
 * trigger it from the admin screen.
 */
async function run() {
  const db = getDb();
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);

  const congregations = db.prepare(
    `SELECT DISTINCT congregation_id AS id FROM territories`
  ).all() as { id: string | null }[];

  let overdueSent = 0;
  let weeklySent = 0;

  for (const { id: congreId } of congregations) {
    const s = getMessagingSettings(congreId);

    const rows = db.prepare(`
      SELECT t.id, t.number, t.name, t.assigned_to, t.visit_start, t.pairs_count,
             u.name AS user_name
      FROM territories t
      JOIN users u ON u.id = t.assigned_to
      WHERE t.assigned_to IS NOT NULL
        AND t.visit_end IS NULL
        AND t.status != 'completed'
        AND t.congregation_id IS ?
    `).all(congreId) as {
      id: string; number: number | null; name: string; assigned_to: string;
      visit_start: string | null; pairs_count: number | null; user_name: string;
    }[];

    for (const t of rows) {
      const label = `${t.number != null ? t.number + '. ' : ''}${t.name}`;
      const start = t.visit_start;
      const days = start
        ? Math.floor((Date.parse(iso) - Date.parse(start)) / 86_400_000)
        : 0;
      const vars = {
        nombre: t.user_name,
        territorio: label,
        fecha: start ?? '',
        dias: String(days),
        parejas: t.pairs_count ? `Parejas asignadas: ${t.pairs_count}. ` : '',
      };

      // ── Overdue ────────────────────────────────────────────────────────
      if (s.notify_overdue && start && days >= s.overdue_days) {
        const sent = await notify({
          userId: t.assigned_to,
          congregationId: congreId,
          kind: 'territory_overdue',
          title: `Territorio ${label} pendiente`,
          body: renderTemplate(s.template_overdue || DEFAULT_TEMPLATES.overdue, vars),
          territoryId: t.id,
          // one overdue notice per assignment start
          dedupeKey: `overdue:${t.id}:${start}`,
        });
        if (sent) overdueSent++;
      }

      // ── Weekly progress request ────────────────────────────────────────
      if (s.notify_weekly_status && start) {
        const y = today.getUTCFullYear();
        const week = Math.floor(
          (Date.UTC(y, today.getUTCMonth(), today.getUTCDate()) - Date.UTC(y, 0, 1)) / 604_800_000
        );
        const sent = await notify({
          userId: t.assigned_to,
          congregationId: congreId,
          kind: 'territory_weekly',
          title: `¿Cómo vas con el territorio ${label}?`,
          body: renderTemplate(s.template_weekly || DEFAULT_TEMPLATES.weekly, vars),
          territoryId: t.id,
          dedupeKey: `weekly:${t.id}:${start}:${y}-w${week}`,
        });
        if (sent) weeklySent++;
      }
    }
  }

  return { overdueSent, weeklySent };
}

export async function POST(request: Request) {
  try {
    // Either an authenticated user, or cron presenting the shared secret.
    const ctx = await getSessionContext();
    const secret = process.env.CRON_SECRET;
    const provided = request.headers.get('x-cron-secret');
    if (!ctx.userId && !(secret && provided === secret)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const result = await run();
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
