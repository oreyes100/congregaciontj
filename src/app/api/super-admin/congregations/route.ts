import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

function unauthorized() {
  return NextResponse.json({ error: 'Super-admin required' }, { status: 403 });
}

/** GET /api/super-admin/congregations — list all congregations with user counts */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return unauthorized();

  const { data: congres, error } = await sb()
    .from('congregations')
    .select('*')
    .order('name');

  // Table may not exist yet (migration pending)
  if (error) return NextResponse.json({ congregations: [], migration_pending: true });

  // User counts per congregation
  const { data: counts } = await sb()
    .from('users')
    .select('congregation_id');

  const countMap: Record<string, number> = {};
  for (const u of counts || []) {
    if (u.congregation_id) countMap[u.congregation_id] = (countMap[u.congregation_id] || 0) + 1;
  }

  const rows = (congres || []).map((c: any) => ({ ...c, user_count: countMap[c.id] || 0 }));
  return NextResponse.json({ congregations: rows });
}

/** POST /api/super-admin/congregations — create new congregation */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return unauthorized();

  const body = await request.json();
  const { name, city, enabled_modules } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data, error } = await sb()
    .from('congregations')
    .insert({ name: name.trim(), city: city?.trim() || null, enabled_modules: enabled_modules ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ congregation: data });
}

/** PUT /api/super-admin/congregations — update congregation (name/city/enabled/modules) */
export async function PUT(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return unauthorized();

  const body = await request.json();
  const { id, name, city, enabled, enabled_modules } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (city !== undefined) patch.city = city;
  if (enabled !== undefined) patch.enabled = enabled;
  if (enabled_modules !== undefined) patch.enabled_modules = enabled_modules;

  const { error } = await sb().from('congregations').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/super-admin/congregations?id=... */
export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Check no users remain
  const { data: users } = await sb().from('users').select('id').eq('congregation_id', id).limit(1);
  if (users?.length) return NextResponse.json({ error: 'Congregation still has users' }, { status: 409 });

  const { error } = await sb().from('congregations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
