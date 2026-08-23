import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const history = db.prepare(`
      SELECT h.*, o.number AS outline_number, o.title AS outline_title
      FROM public_talk_history h
      LEFT JOIN public_talk_outlines o ON o.id = h.outline_id
      ORDER BY h.date DESC
    `).all() as Record<string, unknown>[];

    // Shape: embed outline as sub-object to match previous supabase response
    const shaped = history.map((h) => ({
      ...h,
      outline: h.outline_id ? { number: h.outline_number, title: h.outline_title } : null,
    }));

    return NextResponse.json({ history: shaped });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
