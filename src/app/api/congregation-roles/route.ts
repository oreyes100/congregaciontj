import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

export interface RoleDef {
  role_key: string;
  label: string;
  category: string;
  sub_label?: string;
}

export const ROLES_CATALOG: RoleDef[] = [
  // Cuerpo de Ancianos
  { role_key: 'elders_coordinator',       label: 'Coordinador del Cuerpo de Ancianos',     category: 'Cuerpo de Ancianos' },
  { role_key: 'watchtower_conductor',     label: 'Conductor del Estudio de la Atalaya',    category: 'Cuerpo de Ancianos' },
  { role_key: 'secretary',               label: 'Secretario',                              category: 'Cuerpo de Ancianos' },
  { role_key: 'service_overseer',        label: 'Superintendente de Servicio',             category: 'Cuerpo de Ancianos' },
  { role_key: 'life_ministry_coordinator', label: 'Coordinador VMC',                       category: 'Cuerpo de Ancianos' },
  // Secretaría
  { role_key: 'report_submission',       label: 'Envío de Informes',                       category: 'Secretaría' },
  { role_key: 'pioneer_analysis',        label: 'Analizar – Actividad de los Precursores', category: 'Secretaría' },
  { role_key: 'readers',                 label: 'Lectores',                                category: 'Secretaría', sub_label: 'S-21' },
  { role_key: 'publisher_cards',         label: 'Tarjetas de Publicador',                  category: 'Secretaría', sub_label: 'S-21' },
  { role_key: 'congregation_archive',    label: 'Archivo de Congregación',                 category: 'Secretaría', sub_label: 'S-61' },
  { role_key: 'correspondence',          label: 'Envío de Correspondencia',                category: 'Secretaría' },
  // Vida y Ministerio Cristiano
  { role_key: 'midweek_overseer',        label: 'Superintendente Reunión VMC',             category: 'Vida y Ministerio Cristiano' },
  { role_key: 'board_overseer',          label: 'Tablero',                                 category: 'Vida y Ministerio Cristiano' },
  { role_key: 'aux_hall_overseer',       label: 'Sala Auxiliar',                           category: 'Vida y Ministerio Cristiano' },
  { role_key: 'auxiliary_counselor',     label: 'Consejero Auxiliar',                      category: 'Vida y Ministerio Cristiano' },
  // Servicio de Campo
  { role_key: 'pioneer_analysis_svc',   label: 'Analizar – Actividad de los Precursores', category: 'Servicio de Campo' },
  { role_key: 'reading_school',         label: 'Escuela de Lectura y Escritura',          category: 'Servicio de Campo' },
  { role_key: 'group_visits',           label: 'Visita a los Grupos',                     category: 'Servicio de Campo' },
  { role_key: 'co_visit_organizer',     label: 'Organizar Visita del SC',                 category: 'Servicio de Campo' },
  { role_key: 'pioneer_training',       label: 'Capacitación P.P',                        category: 'Servicio de Campo' },
  // Reuniones y Salón
  { role_key: 'weekend_chairman',       label: 'Presidente (Fin de Semana)',              category: 'Reuniones y Salón' },
  { role_key: 'av_overseer',            label: 'Audio y Video',                           category: 'Reuniones y Salón' },
  { role_key: 'platform_overseer',      label: 'Plataforma',                              category: 'Reuniones y Salón' },
  { role_key: 'attendants_overseer',    label: 'Acomodadores',                            category: 'Reuniones y Salón' },
  { role_key: 'cleaning_overseer',      label: 'Limpieza',                                category: 'Reuniones y Salón' },
  // Administración
  { role_key: 'accounts_servant',       label: 'Intervención de Cuentas',                 category: 'Administración' },
  { role_key: 'literature_servant',     label: 'Siervo de Publicaciones',                 category: 'Administración' },
  { role_key: 'accounting',            label: 'Contabilidad',                             category: 'Administración' },
  { role_key: 'library',              label: 'Biblioteca',                                category: 'Administración' },
  // Custom
  { role_key: 'custom',               label: 'Personalizado',                             category: 'Otros' },
];

interface DbRole {
  role_key: string;
  label: string;
  custom_label: string | null;
  person_id: string | null;
  assistant_1_id: string | null;
  assistant_2_id: string | null;
}
interface DbUser { id: string; first_name: string | null; last_name: string | null; display_name: string | null }

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();

    const existingRows = (
      ctx.congreId
        ? db.prepare(`SELECT * FROM congregation_roles WHERE congregation_id = ?`).all(ctx.congreId)
        : db.prepare(`SELECT * FROM congregation_roles WHERE congregation_id IS NULL`).all()
    ) as DbRole[];

    const byKey = Object.fromEntries(existingRows.map(r => [r.role_key, r]));

    const userIds = new Set<string>();
    for (const r of existingRows) {
      if (r.person_id) userIds.add(r.person_id);
      if (r.assistant_1_id) userIds.add(r.assistant_1_id);
      if (r.assistant_2_id) userIds.add(r.assistant_2_id);
    }

    const usersById: Record<string, DbUser> = {};
    if (userIds.size > 0) {
      const ph = Array.from(userIds).map(() => '?').join(',');
      const users = db.prepare(`SELECT id, first_name, last_name, display_name FROM users WHERE id IN (${ph})`).all(...Array.from(userIds)) as DbUser[];
      for (const u of users) usersById[u.id] = u;
    }

    const roleUser = (id: string | null) => (id ? (usersById[id] ?? null) : null);

    const roles = ROLES_CATALOG.map(def => {
      const row = byKey[def.role_key];
      return {
        role_key: def.role_key,
        label: def.label,
        category: def.category,
        sub_label: def.sub_label ?? null,
        custom_label: row?.custom_label ?? null,
        person: roleUser(row?.person_id ?? null),
        assistant_1: roleUser(row?.assistant_1_id ?? null),
        assistant_2: roleUser(row?.assistant_2_id ?? null),
      };
    });

    return NextResponse.json({ roles });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const db = getDb();
    const body = await request.json();
    const { role_key, person_id, assistant_1_id, assistant_2_id, custom_label } = body;
    if (!role_key) return NextResponse.json({ error: 'role_key is required' }, { status: 400 });

    const def = ROLES_CATALOG.find(r => r.role_key === role_key);
    const label = def?.label ?? role_key;
    const congreId = ctx.congreId ?? null;

    const existing = congreId
      ? db.prepare(`SELECT role_key FROM congregation_roles WHERE role_key = ? AND congregation_id = ?`).get(role_key, congreId)
      : db.prepare(`SELECT role_key FROM congregation_roles WHERE role_key = ? AND congregation_id IS NULL`).get(role_key);

    if (existing) {
      const sets: string[] = ['updated_at = ?'];
      const vals: unknown[] = [new Date().toISOString()];
      if ('person_id' in body) { sets.push('person_id = ?'); vals.push(person_id ?? null); }
      if ('assistant_1_id' in body) { sets.push('assistant_1_id = ?'); vals.push(assistant_1_id ?? null); }
      if ('assistant_2_id' in body) { sets.push('assistant_2_id = ?'); vals.push(assistant_2_id ?? null); }
      if ('custom_label' in body) { sets.push('custom_label = ?'); vals.push(custom_label ?? null); }
      if (congreId) {
        db.prepare(`UPDATE congregation_roles SET ${sets.join(', ')} WHERE role_key = ? AND congregation_id = ?`).run(...vals, role_key, congreId);
      } else {
        db.prepare(`UPDATE congregation_roles SET ${sets.join(', ')} WHERE role_key = ? AND congregation_id IS NULL`).run(...vals, role_key);
      }
    } else {
      db.prepare(`
        INSERT INTO congregation_roles (role_key, label, person_id, assistant_1_id, assistant_2_id, custom_label, congregation_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        role_key, label,
        'person_id' in body ? (person_id ?? null) : null,
        'assistant_1_id' in body ? (assistant_1_id ?? null) : null,
        'assistant_2_id' in body ? (assistant_2_id ?? null) : null,
        'custom_label' in body ? (custom_label ?? null) : null,
        congreId,
        new Date().toISOString()
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
