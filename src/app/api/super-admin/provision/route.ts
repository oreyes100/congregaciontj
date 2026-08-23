import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getDb } from '@/lib/sqlite';
import { sb } from '@/lib/crud';

function unauthorized() {
  return NextResponse.json({ error: 'Super-admin required' }, { status: 403 });
}

/**
 * POST /api/super-admin/provision
 * Creates a congregation + its first admin user in one atomic operation.
 *
 * Body:
 *   congregation_name  string  required
 *   congregation_city  string  optional
 *   enabled_modules    string[] optional (defaults to all)
 *   admin_first_name   string  required
 *   admin_last_name    string  optional
 *   admin_email        string  required  — used for Supabase Auth login
 *   admin_password     string  required  (min 8 chars)
 *   admin_username     string  optional  — shorthand login alias
 *
 * Returns: { congregation, user, credentials }
 * credentials.password is returned ONCE — store it before closing.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return unauthorized();

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    congregation_name,
    congregation_city,
    enabled_modules,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_password,
    admin_username,
  } = body;

  if (!congregation_name?.trim()) return NextResponse.json({ error: 'congregation_name required' }, { status: 400 });
  if (!admin_first_name?.trim()) return NextResponse.json({ error: 'admin_first_name required' }, { status: 400 });
  if (!admin_email?.trim()) return NextResponse.json({ error: 'admin_email required' }, { status: 400 });
  if (!admin_password || admin_password.length < 8) return NextResponse.json({ error: 'admin_password must be ≥ 8 characters' }, { status: 400 });

  const email = admin_email.trim().toLowerCase();
  const displayName = [admin_first_name.trim(), admin_last_name?.trim()].filter(Boolean).join(' ');
  const username = admin_username?.trim().toLowerCase() || null;
  const passwordHash = await bcrypt.hash(String(admin_password), 10);

  // 1. Create congregation via shim
  const congreId = crypto.randomUUID();
  const { data: congre, error: cErr } = await sb()
    .from('congregations')
    .insert({ id: congreId, name: congregation_name.trim(), city: congregation_city?.trim() || null, enabled: true, enabled_modules: enabled_modules ?? null })
    .selectAfter().single();
  if (cErr) return NextResponse.json({ error: `Error creating congregation: ${cErr.message}` }, { status: 500 });

  // 2. Upsert user (no GoTrue — just bcrypt hash in users table)
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE lower(auth_email) = ? OR lower(email) = ? LIMIT 1`).get(email, email) as { id: string } | undefined;

  let userRow: Record<string, unknown> | null = null;
  let uErr: { message: string } | null = null;

  if (existing?.id) {
    const { data, error } = await sb().from('users').update({
      first_name: admin_first_name.trim(),
      last_name: admin_last_name?.trim() || null,
      name: displayName,
      display_name: displayName,
      auth_email: email,
      email1: email,
      ...(username ? { username } : {}),
      app_role: 'admin',
      congregation_id: congreId,
      is_active: true,
      is_super_admin: false,
      password_hash: passwordHash,
    }).eq('id', existing.id).selectAfter().single();
    userRow = data as Record<string, unknown>; uErr = error;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await sb().from('users').insert({
      id: newId,
      first_name: admin_first_name.trim(),
      last_name: admin_last_name?.trim() || null,
      name: displayName,
      display_name: displayName,
      email,
      email1: email,
      auth_email: email,
      ...(username ? { username } : {}),
      app_role: 'admin',
      permissions: '[]',
      congregation_id: congreId,
      is_active: true,
      is_publisher: false,
      is_super_admin: false,
      status: 'active',
      password_hash: passwordHash,
    }).selectAfter().single();
    userRow = data as Record<string, unknown>; uErr = error;
  }

  if (uErr) {
    await sb().from('congregations').delete().eq('id', congreId);
    return NextResponse.json({ error: `Error creating user record: ${uErr.message}` }, { status: 500 });
  }

  const congreData = congre as Record<string, unknown>;
  return NextResponse.json({
    congregation: { id: congreData.id, name: congreData.name, city: congreData.city },
    user: {
      id: userRow!.id,
      name: displayName,
      email,
      username: userRow!.username || null,
    },
    credentials: {
      login_identifier: (userRow!.username as string | null) || email,
      password: admin_password,
      login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
    },
  });
}
