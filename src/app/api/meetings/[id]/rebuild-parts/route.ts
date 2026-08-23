import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { getProgram, type ProgramPart } from '@/lib/programs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();
    const body = await request.json().catch(() => ({}));
    const preserveAssignments = body?.preserveAssignments !== false;

    let mQuery = supabase
      .from('meetings')
      .select('id, date')
      .eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) mQuery = mQuery.eq('congregation_id', ctx.congreId);

    const { data: meeting, error: mError } = await mQuery.single();
    if (mError) throw mError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    const mtg = meeting as { id: string; date: string };

    const program = getProgram(mtg.date);

    const existingByPartNumber: Record<number, { assigned_user_id?: string | null; assistant_user_id?: string | null }> = {};
    if (preserveAssignments) {
      const { data: existingParts } = await supabase
        .from('meeting_parts')
        .select('part_number, assigned_user_id, assistant_user_id')
        .eq('meeting_id', id);
      for (const p of existingParts || []) {
        if (p.part_number != null) {
          existingByPartNumber[p.part_number] = {
            assigned_user_id: p.assigned_user_id,
            assistant_user_id: p.assistant_user_id,
          };
        }
      }
    }

    const { error: dError } = await supabase
      .from('meeting_parts')
      .delete()
      .eq('meeting_id', id);
    if (dError) throw dError;

    const newParts = program.parts.map((p: ProgramPart) => {
      const carry = existingByPartNumber[p.number] || {};
      return {
        meeting_id: id,
        class_type: 'main',
        part_type: p.type,
        part_number: p.number,
        title: p.title,
        duration_minutes: p.duration,
        role: p.role,
        student_part_type: p.student_part_type || null,
        assigned_user_id: carry.assigned_user_id || null,
        assistant_user_id: carry.assistant_user_id || null,
      };
    });

    const { error: iError } = await supabase
      .from('meeting_parts')
      .insert(newParts);
    if (iError) throw iError;

    await supabase
      .from('meetings')
      .update({
        song_opening: program.songOpening,
        song_middle: program.songMiddle,
        song_closing: program.songClosing,
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      weekLabel: program.weekLabel,
      partsCreated: newParts.length,
      assignmentsPreserved: preserveAssignments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to rebuild parts';
    console.error('rebuild-parts error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
