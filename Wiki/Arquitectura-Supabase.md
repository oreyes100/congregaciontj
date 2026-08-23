# Arquitectura Supabase — Meeting Scheduler Pro

Esquema multi-tenant con RLS (Row Level Security). Cada congregación tiene sus propios datos aislados por `congregation_id`.

## Tablas Core

### persons
Registro maestro de publicadores. ~40 flags de capacidad para auto-asignación.

| Campo clave | Tipo | Uso |
|---|---|---|
| `is_elder` | bool | Chairman, CBS conductor |
| `can_be_chairman` | bool | Presidir reuniones |
| `can_do_gems` | bool | Perlas Espirituales |
| `can_do_bible_reading` | bool | Lectura Bíblica |
| `can_do_student_parts` | bool | Partes de estudiante |
| `can_be_speaker` | bool | Discurso de Tesoros |
| `speaker_local / speaker_visiting` | bool | Para reunión de fin de semana |

### meetings
Una fila por semana de reunión entre semana.

```
id, date, congregation_id, chairman_id,
songs (jsonb: {opening, middle, closing}),
cbs_conductor_id, cbs_reader_id,
assembly_type (nullable: 'regional' | 'circuit')
```

### meeting_parts
Partes individuales de cada reunión. FK a `meetings.id`.

```
id, meeting_id, part_number, type,
title, duration, assigned_user_id,
student_part_type, requires_assistant
```

### weekend_meetings
Reunión de fin de semana (discurso público).

### territories
Polígonos geoespaciales (jsonb Leaflet) para territorios.

## Patrón de Acceso

- Cliente: `@supabase/ssr` con cookies Next.js
- Server: `supabaseAdmin` (service_role) para auto-assign
- Todas las queries filtran por `congregation_id`

## Fuente
- `src/types/index.ts` — interfaces TypeScript
- `src/lib/supabase.ts` — cliente Supabase
- `sql/` — migraciones SQL
