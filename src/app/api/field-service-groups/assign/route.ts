import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { user_id, group_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    const supabase = sb();

    // Both ids arrive from the client, so a congregation admin could otherwise
    // reassign a publisher belonging to another congregation. Super-admins have
    // no congreId and are intentionally not scoped.
    if (ctx.congreId) {
      const { data: target } = await supabase
        .from('users').select('id').eq('id', user_id).eq('congregation_id', ctx.congreId).maybeSingle();
      if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      if (group_id) {
        const { data: group } = await supabase
          .from('field_service_groups').select('id').eq('id', group_id).eq('congregation_id', ctx.congreId).maybeSingle();
        if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const { error: delErr } = await supabase.from('field_service_group_members').delete().eq('user_id', user_id);
    if (delErr) throw delErr;

    if (group_id) {
      const { error } = await supabase.from('field_service_group_members').insert({ user_id, group_id, role: 'member' });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
