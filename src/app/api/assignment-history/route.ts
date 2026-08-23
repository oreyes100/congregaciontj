import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const filter = ctx.congreId && !ctx.isSuperAdmin;

    let meetingsQuery = supabase
      .from('meetings')
      .select('id, date')
      .order('date', { ascending: false });
    if (filter) meetingsQuery = meetingsQuery.eq('congregation_id', ctx.congreId!);
    const { data: meetings, error: meetErr } = await meetingsQuery;
    if (meetErr) throw meetErr;

    const meetingIds = ((meetings || []) as any[]).map((m: any) => m.id);
    const dateById: Record<string, string> = {};
    for (const m of meetings || []) dateById[m.id] = m.date;

    let partsQuery = supabase
      .from('meeting_parts')
      .select('assigned_user_id, assistant_user_id, part_type, student_part_type, title, role, meeting_id')
      .not('assigned_user_id', 'is', null);
    if (filter && meetingIds.length > 0) {
      partsQuery = partsQuery.in('meeting_id', meetingIds);
    } else if (filter) {
      return NextResponse.json({ history: {} });
    }
    const { data: parts, error: partsErr } = await partsQuery;
    if (partsErr) throw partsErr;

    const history: Record<string, Record<string, { date: string; title: string }>> = {};

    let rolesQuery = supabase
      .from('meetings')
      .select('date, chairman_id, opening_prayer_id, closing_prayer_id, cbs_conductor_id, cbs_reader_id')
      .order('date', { ascending: false });
    if (filter) rolesQuery = rolesQuery.eq('congregation_id', ctx.congreId!);
    const { data: meetingRoles, error: mrErr } = await rolesQuery;

    if (!mrErr && meetingRoles) {
      for (const m of meetingRoles) {
        const entries: [string | null, string][] = [
          [m.chairman_id, 'chairman'],
          [m.opening_prayer_id, 'opening_prayer'],
          [m.closing_prayer_id, 'closing_prayer'],
          [m.cbs_conductor_id, 'cbs_conductor'],
          [m.cbs_reader_id, 'cbs_reader'],
        ];
        for (const [uid, role] of entries) {
          if (!uid) continue;
          if (!history[uid]) history[uid] = {};
          if (!history[uid][role]) {
            history[uid][role] = { date: m.date, title: '' };
          }
        }
      }
    }

    const sortedParts = (parts || [])
      .map((p: any) => ({ ...p, date: dateById[p.meeting_id] || '' }))
      .filter((p: any) => p.date)
      .sort((a: any, b: any) => b.date.localeCompare(a.date));

    for (const p of sortedParts) {
      const uid = p.assigned_user_id;
      if (!uid) continue;
      if (!history[uid]) history[uid] = {};

      let roleKey = p.part_type || p.role || 'unknown';
      if (p.part_type === 'student_part' && p.student_part_type) {
        roleKey = `student_${p.student_part_type}`;
      }

      if (!history[uid][roleKey]) {
        history[uid][roleKey] = { date: p.date, title: p.title || '' };
      }

      if (p.assistant_user_id) {
        if (!history[p.assistant_user_id]) history[p.assistant_user_id] = {};
        if (!history[p.assistant_user_id]['assistant']) {
          history[p.assistant_user_id]['assistant'] = { date: p.date, title: p.title || '' };
        }
      }
    }

    return NextResponse.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch assignment history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
