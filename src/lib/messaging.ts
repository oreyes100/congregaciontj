/**
 * Messaging for the territory module.
 *
 * Two delivery channels:
 *  1. Platform — a row in `messages`, surfaced in the app's inbox. Always written.
 *  2. WhatsApp — best-effort, only when the congregation enabled it AND the
 *     recipient has a phone number on their profile. Failures are recorded on
 *     the message row and never abort the caller.
 */
import { randomUUID } from 'crypto';
import { getDb } from './sqlite';

export interface MessagingSettings {
  congregation_id: string | null;
  whatsapp_enabled: number;
  provider: string;
  phone_number_id: string | null;
  access_token: string | null;
  sender_label: string | null;
  notify_on_assign: number;
  notify_overdue: number;
  overdue_days: number;
  notify_weekly_status: number;
  weekly_status_dow: number;
  template_assign: string | null;
  template_overdue: string | null;
  template_weekly: string | null;
}

export const DEFAULT_TEMPLATES = {
  assign:
    'Hola {{nombre}}, se te asignó el territorio {{territorio}} el {{fecha}}. ' +
    '{{parejas}}Por favor confirma cuando lo comiences. ¡Gracias por tu servicio!',
  overdue:
    'Hola {{nombre}}, el territorio {{territorio}} se te asignó el {{fecha}} y ya pasaron {{dias}} días. ' +
    '¿Necesitas más tiempo o ya puedes entregarlo?',
  weekly:
    'Hola {{nombre}}, ¿cómo vas con el territorio {{territorio}}? ' +
    'Responde con tu avance para actualizar el registro. ¡Gracias!',
};

export function getMessagingSettings(congregationId: string | null): MessagingSettings {
  const db = getDb();
  const row = (congregationId
    ? db.prepare(`SELECT * FROM messaging_settings WHERE congregation_id = ?`).get(congregationId)
    : db.prepare(`SELECT * FROM messaging_settings WHERE congregation_id IS NULL`).get()
  ) as MessagingSettings | undefined;

  return {
    congregation_id: congregationId,
    whatsapp_enabled: row?.whatsapp_enabled ?? 0,
    provider: row?.provider ?? 'cloud',
    phone_number_id: row?.phone_number_id ?? null,
    access_token: row?.access_token ?? null,
    sender_label: row?.sender_label ?? null,
    notify_on_assign: row?.notify_on_assign ?? 1,
    notify_overdue: row?.notify_overdue ?? 1,
    overdue_days: row?.overdue_days ?? 7,
    notify_weekly_status: row?.notify_weekly_status ?? 1,
    weekly_status_dow: row?.weekly_status_dow ?? 1,
    template_assign: row?.template_assign ?? null,
    template_overdue: row?.template_overdue ?? null,
    template_weekly: row?.template_weekly ?? null,
  };
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

/** Digits only, with a default country code when the profile omits it. */
export function normalizePhone(raw: string | null | undefined, defaultCc = '52'): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.length <= 10 ? defaultCc + digits : digits;
}

async function sendWhatsApp(
  settings: MessagingSettings,
  phone: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!settings.phone_number_id || !settings.access_token) {
    return { ok: false, error: 'WhatsApp no configurado (falta phone_number_id o access_token)' };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { preview_url: false, body },
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface NotifyInput {
  userId: string | null;
  congregationId: string | null;
  kind: 'territory_assigned' | 'territory_overdue' | 'territory_weekly';
  title: string;
  body: string;
  territoryId?: string | null;
  imageData?: string | null;
  /** When set, the message is written at most once (unique index on dedupe_key). */
  dedupeKey?: string | null;
}

/**
 * Writes the platform message and, when possible, delivers it over WhatsApp.
 * Returns null when a dedupeKey collided (message already sent).
 */
export async function notify(input: NotifyInput): Promise<{ id: string; whatsapp: string } | null> {
  const db = getDb();
  const id = randomUUID();

  if (input.dedupeKey) {
    const existing = db.prepare(`SELECT id FROM messages WHERE dedupe_key = ?`).get(input.dedupeKey);
    if (existing) return null;
  }

  const settings = getMessagingSettings(input.congregationId);
  const user = input.userId
    ? (db.prepare(`SELECT id, name, phone1, phone2 FROM users WHERE id = ?`).get(input.userId) as
        { id: string; name: string; phone1: string | null; phone2: string | null } | undefined)
    : undefined;

  let waStatus = 'disabled';
  let waError: string | null = null;

  if (settings.whatsapp_enabled) {
    const phone = normalizePhone(user?.phone1) ?? normalizePhone(user?.phone2);
    if (!phone) {
      waStatus = 'skipped';
      waError = 'El perfil no tiene teléfono';
    } else {
      const prefix = settings.sender_label ? `*${settings.sender_label}*\n` : '';
      const r = await sendWhatsApp(settings, phone, prefix + input.body);
      waStatus = r.ok ? 'sent' : 'failed';
      waError = r.error ?? null;
    }
  }

  db.prepare(`
    INSERT INTO messages (id, user_id, kind, title, body, image_data, territory_id,
                          whatsapp_status, whatsapp_error, dedupe_key, congregation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId ?? null,
    input.kind,
    input.title,
    input.body,
    input.imageData ?? null,
    input.territoryId ?? null,
    waStatus,
    waError,
    input.dedupeKey ?? null,
    input.congregationId ?? null,
  );

  return { id, whatsapp: waStatus };
}
