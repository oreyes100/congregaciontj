import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

function userCols(alias: string, prefix: string) {
  return `${alias}.id as ${prefix}_id, ${alias}.first_name as ${prefix}_first, ${alias}.last_name as ${prefix}_last, ${alias}.display_name as ${prefix}_display, ${alias}.name as ${prefix}_name`;
}
function userObj(row: Record<string, unknown>, prefix: string) {
  const id = row[`${prefix}_id`];
  if (!id) return null;
  return { id, first_name: row[`${prefix}_first`], last_name: row[`${prefix}_last`], display_name: row[`${prefix}_display`], name: row[`${prefix}_name`] };
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();

    let sql = `
      SELECT wm.*,
        o.id as o_id, o.number as o_number, o.title as o_title, o.theme as o_theme,
        ${userCols('ls', 'ls')},
        vs.id as vs_id, vs.name as vs_org_name, vs.congregation_id as vs_cong, vs.outline_numbers as vs_outlines, vs.email as vs_email, vs.phone as vs_phone,
        ${userCols('ch', 'ch')},
        ${userCols('wtc', 'wtc')},
        ${userCols('wtr', 'wtr')},
        ${userCols('hp', 'hp')}
      FROM weekend_meetings wm
      LEFT JOIN public_talk_outlines o ON o.id = wm.outline_id
      LEFT JOIN users ls ON ls.id = wm.local_speaker_id
      LEFT JOIN public_speakers vs ON vs.id = wm.visiting_speaker_id
      LEFT JOIN users ch ON ch.id = wm.chairman_id
      LEFT JOIN users wtc ON wtc.id = wm.wt_conductor_id
      LEFT JOIN users wtr ON wtr.id = wm.wt_reader_id
      LEFT JOIN users hp ON hp.id = wm.hospitality_person_id
    `;
    const params: unknown[] = [];
    if (ctx.congreId) { sql += ' WHERE wm.congregation_id = ?'; params.push(ctx.congreId); }
    sql += ' ORDER BY wm.date ASC';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const meetings = rows.map(r => {
      const { o_id, o_number, o_title, o_theme,
        ls_id, ls_first, ls_last, ls_display, ls_name,
        vs_id, vs_org_name, vs_cong, vs_outlines, vs_email, vs_phone,
        ch_id, ch_first, ch_last, ch_display, ch_name,
        wtc_id, wtc_first, wtc_last, wtc_display, wtc_name,
        wtr_id, wtr_first, wtr_last, wtr_display, wtr_name,
        hp_id, hp_first, hp_last, hp_display, hp_name,
        ...rest } = r;
      return {
        ...rest,
        outline: o_id ? { id: o_id, number: o_number, title: o_title, theme: o_theme } : null,
        local_speaker: userObj(r, 'ls'),
        visiting_speaker: vs_id ? { id: vs_id, name: vs_org_name, congregation_id: vs_cong, outline_numbers: vs_outlines, email: vs_email, phone: vs_phone } : null,
        chairman: userObj(r, 'ch'),
        wt_conductor: userObj(r, 'wtc'),
        wt_reader: userObj(r, 'wtr'),
        hospitality_person: userObj(r, 'hp'),
      };
    });
    return NextResponse.json({ meetings });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const supabase = sb();
    const body = await request.json();
    const { date } = body;
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { data, error } = await supabase
      .from('weekend_meetings')
      .insert({ date, speaker_type: 'local', congregation_id: ctx.congreId ?? null })
      .select().single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('UNIQUE') || error.message?.includes('duplicate')) {
        // Same congregation already owns this week — return it so the click is idempotent.
        let q = supabase.from('weekend_meetings').select().eq('date', date);
        if (ctx.congreId) q = q.eq('congregation_id', ctx.congreId);
        const { data: existing } = await q.maybeSingle();
        if (existing) return NextResponse.json({ meeting: existing }, { status: 200 });
        // A collision with no row of our own means the date is still globally
        // unique in this database — the schema migration has not been applied.
        return NextResponse.json({
          error: 'Esta semana está ocupada por otra congregación. La base de datos aún tiene la restricción antigua UNIQUE(date); reinicia la aplicación para aplicar la migración.',
        }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ meeting: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
