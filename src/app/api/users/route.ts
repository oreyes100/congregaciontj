import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    let query = sb()
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (ctx.congreId && !ctx.isSuperAdmin) {
      query = query.eq('congregation_id', ctx.congreId);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    return NextResponse.json({ users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const body = await request.json();

    if (ctx.congreId && !ctx.isSuperAdmin) {
      body.congregation_id = ctx.congreId;
    }

    const { data: user, error } = await sb()
      .from('users')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
