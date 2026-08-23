import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    let meetingUpdate = supabase
      .from('meetings')
      .update({
        song_opening: body.song_opening,
        song_middle: body.song_middle,
        song_closing: body.song_closing,
        chairman_id: body.chairman_id || null,
        opening_prayer_id: body.opening_prayer_id || null,
        closing_prayer_id: body.closing_prayer_id || null,
        cbs_conductor_id: body.cbs_conductor_id || null,
        cbs_reader_id: body.cbs_reader_id || null,
        cleaning_group: body.cleaning_group ?? null,
        assembly_type: body.assembly_type ?? null,
      })
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) meetingUpdate = meetingUpdate.eq('congregation_id', ctx.congreId);
    const { error: meetingError } = await meetingUpdate;
    if (meetingError) throw meetingError;

    if (body.parts && Array.isArray(body.parts)) {
      for (const part of body.parts) {
        const { error: partError } = await supabase
          .from('meeting_parts')
          .update({
            assigned_user_id: part.assigned_user_id || null,
            title: part.title,
            duration_minutes: part.duration_minutes,
            assistant_user_id: part.assistant_user_id || null,
            student_part_type: part.student_part_type || null,
          })
          .eq('id', part.id);

        if (partError) {
          console.error(`Error updating part ${part.id}:`, partError);
          throw partError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save meeting data';
    console.error(`PUT /api/meetings/[id]/save error:`, error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
