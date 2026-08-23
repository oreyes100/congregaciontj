import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getProgram, type ProgramPart } from '@/lib/programs';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';


const SCHEMA_ERROR_CODES = new Set(['PGRST200', '42703', 'PGRST204']);
function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code !== undefined && SCHEMA_ERROR_CODES.has(error.code)) ||
    (typeof error.message === 'string' && (error.message.includes('relationship') || error.message.includes('column') || error.message.includes('does not exist')))
  );
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();

    let meetingsData: any[] = [];
    let migrationApplied = true;

    let fullQuery = supabase
      .from('meetings')
      .select(`id, title, date, duration_minutes, created_by, song_opening, song_middle, song_closing, chairman_id, opening_prayer_id, closing_prayer_id, cbs_conductor_id, cbs_reader_id, is_published, cleaning_group, assembly_type`)
      .order('date', { ascending: true });
    if (ctx.congreId) fullQuery = fullQuery.eq('congregation_id', ctx.congreId);

    const { data: fullData, error: fullError } = await fullQuery;

    if (fullError) {
      if (isSchemaMissing(fullError)) {
        migrationApplied = false;
        let baseQuery = supabase.from('meetings').select('id, title, date, duration_minutes, created_by').order('date', { ascending: true });
        if (ctx.congreId) baseQuery = baseQuery.eq('congregation_id', ctx.congreId);
        const { data: baseData, error: baseError } = await baseQuery;
        if (baseError) throw baseError;
        meetingsData = baseData || [];
      } else {
        throw fullError;
      }
    } else {
      meetingsData = fullData || [];
    }

    const usersById: Record<string, { id: string; name: string }> = {};
    if (!migrationApplied) {
      const { data: usersData } = await supabase.from('users').select('id, name');
      for (const u of usersData || []) usersById[u.id] = u;
    }

    // Use direct SQLite JOIN — shim doesn't support Supabase fkey join syntax
    const db = getDb();
    const rawParts = db.prepare(`
      SELECT p.id, p.meeting_id, p.role, p.assigned_user_id, p.class_type, p.part_type,
             p.part_number, p.title, p.duration_minutes, p.assistant_user_id,
             p.study_point, p.student_part_type,
             u.id as u_id, u.name as u_name,
             a.id as a_id, a.name as a_name
      FROM meeting_parts p
      LEFT JOIN users u ON u.id = p.assigned_user_id
      LEFT JOIN users a ON a.id = p.assistant_user_id
    `).all() as Record<string, unknown>[];
    const partsData: any[] = rawParts.map(p => ({
      id: p.id, meeting_id: p.meeting_id, role: p.role,
      assigned_user_id: p.assigned_user_id, class_type: p.class_type,
      part_type: p.part_type, part_number: p.part_number, title: p.title,
      duration_minutes: p.duration_minutes, assistant_user_id: p.assistant_user_id,
      study_point: p.study_point, student_part_type: p.student_part_type,
      users: p.u_id ? { id: p.u_id, name: p.u_name } : null,
      assistant: p.a_id ? { id: p.a_id, name: p.a_name } : null,
    }));

    const meetings = meetingsData.map((meeting: any) => {
      const parts = partsData
        .filter((p: any) => p.meeting_id === meeting.id)
        .map((p: any) => ({ ...p, users: Array.isArray(p.users) ? p.users[0] ?? null : p.users, assistant: Array.isArray(p.assistant) ? p.assistant[0] ?? null : p.assistant }))
        .sort((a: any, b: any) => (a.part_number || 0) - (b.part_number || 0));
      return {
        ...meeting, parts,
        chairman: Array.isArray(meeting.chairman) ? meeting.chairman[0] ?? null : (meeting.chairman ?? null),
        _migration_applied: migrationApplied,
      };
    });

    return NextResponse.json({ meetings, migration_applied: migrationApplied });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch meetings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();
    const { title, date, duration_minutes } = body;
    const program = getProgram(date);

    const { data: meeting, error: mError } = await supabase
      .from('meetings')
      .insert({ title: title || 'Life and Ministry Meeting', date, duration_minutes: duration_minutes || 105, song_opening: program.songOpening, song_middle: program.songMiddle, song_closing: program.songClosing, is_published: false, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (mError) {
      // Duplicate (unique constraint on date+congregation_id) — return existing meeting
      if ((mError as any).code === '23505' || (mError as any).message?.includes('UNIQUE')) {
        let existingQuery = supabase.from('meetings').select('id, title, date, duration_minutes').eq('date', date);
        if (ctx.congreId) existingQuery = existingQuery.eq('congregation_id', ctx.congreId);
        const { data: existing } = await existingQuery.single();
        if (existing) return NextResponse.json({ success: true, meeting: existing, partsCreated: 0, existed: true });
      }
      throw mError;
    }
    if (!meeting) throw new Error('Insert returned no row');

    const defaultParts = program.parts.map((p: ProgramPart) => ({
      meeting_id: (meeting as Record<string, unknown>).id,
      class_type: 'main',
      part_type: p.type,
      part_number: p.number,
      title: p.title,
      duration_minutes: p.duration,
      role: p.role,
      student_part_type: p.student_part_type || null,
    }));

    const { error: pError } = await supabase.from('meeting_parts').insert(defaultParts);
    if (pError) throw pError;

    return NextResponse.json({ success: true, meeting, partsCreated: defaultParts.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
