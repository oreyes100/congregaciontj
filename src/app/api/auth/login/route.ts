import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/sqlite';
import { signSession, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';

// In-memory rate limit: key → { count, resetAt }
const attempts = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function getRateLimitKey(request: Request, identifier: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  // Use ip+identifier so shared IPs don't block each other's accounts
  return `${ip}:${identifier}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= LIMIT) return false; // blocked
  entry.count++;
  return true;
}

function clearRateLimit(key: string) {
  attempts.delete(key);
}

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) {
      return NextResponse.json({ error: 'identifier y password requeridos' }, { status: 400 });
    }

    const id = String(identifier).trim().toLowerCase();
    const rlKey = getRateLimitKey(request, id);

    if (!checkRateLimit(rlKey)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera 15 minutos.' },
        { status: 429 }
      );
    }

    const db = getDb();

    const row = db.prepare(`
      SELECT id, auth_email, email, congregation_id, is_super_admin, password_hash, disable_app_access
      FROM users
      WHERE lower(auth_email) = ? OR lower(email) = ? OR lower(username) = ?
      LIMIT 1
    `).get(id, id, id) as {
      id: string;
      auth_email: string | null;
      email: string;
      congregation_id: string | null;
      is_super_admin: number;
      password_hash: string | null;
      disable_app_access: number;
    } | undefined;

    if (!row) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    if (row.disable_app_access) return NextResponse.json({ error: 'Acceso deshabilitado' }, { status: 403 });
    if (!row.password_hash) return NextResponse.json({ error: 'Cuenta sin contraseña configurada' }, { status: 401 });

    // Congregation guard: non-superadmin without congregation cannot log in
    if (!row.is_super_admin && !row.congregation_id) {
      return NextResponse.json(
        { error: 'Cuenta sin congregación asignada. Contacta al administrador.' },
        { status: 403 }
      );
    }

    const valid = await bcrypt.compare(String(password), row.password_hash);
    if (!valid) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });

    // Clear rate-limit counter on successful login
    clearRateLimit(rlKey);

    const token = await signSession(row.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
