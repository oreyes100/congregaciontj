import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await context.params;
    const supabase = sb();

    if (ctx.congreId && !ctx.isSuperAdmin) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('id', id)
        .eq('congregation_id', ctx.congreId)
        .maybeSingle();
      if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: snapshot, error: snapFetchError } = await supabase
      .from('part_snapshots')
      .select('*')
      .eq('meeting_id', id)
      .eq('restored', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapFetchError) throw snapFetchError;
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshot found to restore' }, { status: 404 });
    }

    const snapshotData = snapshot.snapshot_data as {
      parts: Record<string, unknown>[];
      songs?: { song_opening?: number; song_middle?: number; song_closing?: number };
    };

    const { error: dError } = await supabase
      .from('meeting_parts')
      .delete()
      .eq('meeting_id', id);
    if (dError) throw dError;

    const partsToRestore = (snapshotData.parts || []).map((p: Record<string, unknown>) => {
      const { id: _oldId, meeting_id: _mId, ...rest } = p;
      return { ...rest, meeting_id: id };
    });

    if (partsToRestore.length > 0) {
      const { error: iError } = await supabase
        .from('meeting_parts')
        .insert(partsToRestore);
      if (iError) throw iError;
    }

    if (snapshotData.songs) {
      await supabase
        .from('meetings')
        .update({
          song_opening: snapshotData.songs.song_opening ?? null,
          song_middle: snapshotData.songs.song_middle ?? null,
          song_closing: snapshotData.songs.song_closing ?? null,
        })
        .eq('id', id);
    }

    await supabase
      .from('part_snapshots')
      .update({ restored: true, restored_at: new Date().toISOString() })
      .eq('id', snapshot.id);

    return NextResponse.json({
      success: true,
      partsRestored: partsToRestore.length,
      snapshotId: snapshot.id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to undo rebuild';
    console.error('undo-rebuild error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
