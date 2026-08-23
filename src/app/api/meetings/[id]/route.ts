import { NextRequest, NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await params;
    const supabase = sb();

    let mQuery = supabase
      .from('meetings')
      .select(`
        *,
        chairman:chairman_id ( id, name ),
        opening_prayer:opening_prayer_id ( id, name ),
        closing_prayer:closing_prayer_id ( id, name ),
        cbs_conductor:cbs_conductor_id ( id, name ),
        cbs_reader:cbs_reader_id ( id, name )
      `)
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) mQuery = mQuery.eq('congregation_id', ctx.congreId);

    const { data: meeting, error: mError } = await mQuery.single();
    if (mError) throw mError;

    const { data: parts, error: pError } = await supabase
      .from('meeting_parts')
      .select(`
        *,
        users:assigned_user_id ( id, name ),
        assistant:assistant_user_id ( id, name )
      `)
      .eq('meeting_id', id)
      .order('part_number', { ascending: true });

    if (pError) throw pError;

    const meetingWithParts = {
      ...meeting,
      parts: (parts || []).map((part: any) => ({
        ...part,
        users: Array.isArray(part.users) ? part.users[0] : part.users,
        assistant: Array.isArray(part.assistant) ? part.assistant[0] : part.assistant,
      }))
    };

    return NextResponse.json({ meeting: meetingWithParts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch meeting';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await params;
    const supabase = sb();
    const body = await request.json();

    const { parts, ...meetingData } = body;

    let mUpdate = supabase
      .from('meetings')
      .update({
        song_opening: meetingData.song_opening !== undefined ? Number(meetingData.song_opening) : undefined,
        song_middle: meetingData.song_middle !== undefined ? Number(meetingData.song_middle) : undefined,
        song_closing: meetingData.song_closing !== undefined ? Number(meetingData.song_closing) : undefined,
        chairman_id: meetingData.chairman_id !== undefined ? meetingData.chairman_id : undefined,
        opening_prayer_id: meetingData.opening_prayer_id !== undefined ? meetingData.opening_prayer_id : undefined,
        closing_prayer_id: meetingData.closing_prayer_id !== undefined ? meetingData.closing_prayer_id : undefined,
        cbs_conductor_id: meetingData.cbs_conductor_id !== undefined ? meetingData.cbs_conductor_id : undefined,
        cbs_reader_id: meetingData.cbs_reader_id !== undefined ? meetingData.cbs_reader_id : undefined,
        is_published: meetingData.is_published !== undefined ? meetingData.is_published : undefined,
      })
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) mUpdate = mUpdate.eq('congregation_id', ctx.congreId);
    const { error: mError } = await mUpdate;
    if (mError) throw mError;

    if (parts && Array.isArray(parts)) {
      for (const part of parts) {
        if (part.id) {
          const { error: pError } = await supabase
            .from('meeting_parts')
            .update({
              assigned_user_id: part.assigned_user_id !== undefined ? part.assigned_user_id : undefined,
              assistant_user_id: part.assistant_user_id !== undefined ? part.assistant_user_id : undefined,
              title: part.title !== undefined ? part.title : undefined,
              duration_minutes: part.duration_minutes !== undefined ? Number(part.duration_minutes) : undefined,
              class_type: part.class_type !== undefined ? part.class_type : undefined,
              part_number: part.part_number !== undefined ? Number(part.part_number) : undefined,
              part_type: part.part_type !== undefined ? part.part_type : undefined,
              student_part_type: part.student_part_type !== undefined ? part.student_part_type : undefined,
              study_point: part.study_point !== undefined ? part.study_point : undefined,
            })
            .eq('id', part.id);

          if (pError) throw pError;
        } else {
          const { error: pError } = await supabase
            .from('meeting_parts')
            .insert({
              meeting_id: id,
              assigned_user_id: part.assigned_user_id || null,
              assistant_user_id: part.assistant_user_id || null,
              title: part.title,
              duration_minutes: Number(part.duration_minutes || 5),
              class_type: part.class_type || 'main',
              part_number: Number(part.part_number || 99),
              part_type: part.part_type || 'student_part',
              student_part_type: part.student_part_type || 'none',
              role: part.role || 'student'
            });

          if (pError) throw pError;
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Meeting updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update meeting';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await params;
    const supabase = sb();

    let query = supabase
      .from('meetings')
      .delete()
      .eq('id', id);

    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete meeting';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
