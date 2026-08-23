import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();

    // Try with congregation_id (post-migration); fall back if column doesn't exist yet
    let query = sb()
      .from('users')
      .select('id, name, first_name, last_name, email1, auth_email, app_role, permissions, username, congregation_id')
      .order('last_name', { ascending: true });
    if (!ctx.isSuperAdmin && ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query;
    if (error) {
      // congregation_id column may not exist yet — fallback without it
      let q2 = sb()
        .from('users')
        .select('id, name, first_name, last_name, email1, auth_email, app_role, permissions, username')
        .order('last_name', { ascending: true });
      const { data: fb, error: err2 } = await q2;
      if (err2) throw err2;
      return NextResponse.json({ users: fb || [] });
    }

    return NextResponse.json({ users: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { user_id, app_role, permissions, auth_email, username, congregation_id } = body;
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const newEmail = auth_email !== undefined ? (auth_email ? String(auth_email).toLowerCase() : null) : undefined;

    const patch: Record<string, unknown> = {};
    if (app_role !== undefined) patch.app_role = app_role;
    if (permissions !== undefined) patch.permissions = permissions;
    if (newEmail !== undefined) patch.auth_email = newEmail;
    if (username !== undefined) patch.username = username ? String(username).toLowerCase() : null;
    if (congregation_id !== undefined) patch.congregation_id = congregation_id || null;

    const { error } = await sb().from('users').update(patch).eq('id', user_id);
    if (!error) return NextResponse.json({ success: true });

    // congregation_id column may not exist yet — retry without it
    if (congregation_id !== undefined) {
      const { congregation_id: _skip, ...patchWithout } = patch;
      const { error: err2 } = await sb().from('users').update(patchWithout).eq('id', user_id);
      if (err2) throw err2;
      return NextResponse.json({ success: true });
    }
    throw error;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
