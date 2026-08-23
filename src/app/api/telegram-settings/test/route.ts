import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getTelegramSettings, sendTelegram } from '@/lib/telegram';

export async function POST() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const s = getTelegramSettings(ctx.congreId ?? null);

    if (!s.telegram_bot_token) return NextResponse.json({ error: 'No hay bot token configurado' }, { status: 400 });
    if (!s.telegram_chat_id) return NextResponse.json({ error: 'No hay Chat ID configurado' }, { status: 400 });

    const result = await sendTelegram(
      s.telegram_bot_token,
      s.telegram_chat_id,
      '✅ <b>Conexión exitosa</b>\n\nTelegram está correctamente configurado en Meeting Scheduler Pro.',
    );

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
