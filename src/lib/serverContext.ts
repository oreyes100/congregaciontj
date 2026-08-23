import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from './auth';
import { getDb } from './sqlite';

export interface SessionContext {
  userId: string | null;
  congreId: string | null;
  isSuperAdmin: boolean;
  email: string | null;
}

export async function getSessionContext(): Promise<SessionContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { userId: null, congreId: null, isSuperAdmin: false, email: null };

  const session = await verifySession(token);
  if (!session) return { userId: null, congreId: null, isSuperAdmin: false, email: null };

  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, auth_email, congregation_id, is_super_admin
      FROM users WHERE id = ? LIMIT 1
    `).get(session.userId) as { id: string; auth_email: string | null; congregation_id: string | null; is_super_admin: number } | undefined;

    if (!row) return { userId: null, congreId: null, isSuperAdmin: false, email: null };

    const email = row.auth_email?.toLowerCase() ?? null;
    const envAdmins = (process.env.SUPER_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isSuperAdmin = (email ? envAdmins.includes(email) : false) || !!row.is_super_admin;

    return {
      userId: row.id,
      congreId: row.congregation_id ?? null,
      isSuperAdmin,
      email,
    };
  } catch {
    return { userId: null, congreId: null, isSuperAdmin: false, email: null };
  }
}

/** Standard 401 response — use after getSessionContext() when userId is null */
export function unauthenticated() {
  return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
}
