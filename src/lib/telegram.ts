import { getDb } from './sqlite';

export interface TelegramSettings {
  congregation_id: string | null;
  telegram_enabled: number;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_notify_on_assign: number;
  telegram_notify_overdue: number;
  telegram_notify_weekly_status: number;
  telegram_weekly_dow: number;
}

export function getTelegramSettings(congregationId: string | null): TelegramSettings {
  const db = getDb();
  const row = (congregationId
    ? db.prepare(`SELECT * FROM messaging_settings WHERE congregation_id = ?`).get(congregationId)
    : db.prepare(`SELECT * FROM messaging_settings WHERE congregation_id IS NULL`).get()
  ) as Partial<TelegramSettings> | undefined;

  return {
    congregation_id: congregationId,
    telegram_enabled: row?.telegram_enabled ?? 0,
    telegram_bot_token: row?.telegram_bot_token ?? null,
    telegram_chat_id: row?.telegram_chat_id ?? null,
    telegram_notify_on_assign: row?.telegram_notify_on_assign ?? 1,
    telegram_notify_overdue: row?.telegram_notify_overdue ?? 1,
    telegram_notify_weekly_status: row?.telegram_notify_weekly_status ?? 1,
    telegram_weekly_dow: row?.telegram_weekly_dow ?? 1,
  };
}

export async function sendTelegram(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
      },
    );
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' };
  }
}
