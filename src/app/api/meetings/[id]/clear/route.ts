import { NextRequest, NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id: meetingId } = await params;
    const supabase = sb();

    if (ctx.congreId && !ctx.isSuperAdmin) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('id', meetingId)
        .eq('congregation_id', ctx.congreId)
        .maybeSingle();
      if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: mError } = await supabase
      .from('meetings')
      .update({
        chairman_id: null,
        opening_prayer_id: null,
        closing_prayer_id: null,
        cbs_conductor_id: null,
        cbs_reader_id: null,
      })
      .eq('id', meetingId);

    if (mError) throw mError;

    const { error: pError } = await supabase
      .from('meeting_parts')
      .update({
        assigned_user_id: null,
        assistant_user_id: null,
      })
      .eq('meeting_id', meetingId);

    if (pError) throw pError;

    await supabase
      .from('part_history')
      .delete()
      .eq('meeting_id', meetingId);

    return NextResponse.json({
      success: true,
      message: 'All assignments cleared successfully'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear assignments';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
