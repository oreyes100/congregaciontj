# Motor de Auto-Asignación

Asigna automáticamente publicadores a partes de la reunión según disponibilidad, capacidad y rotación.

## Archivos

- `src/services/auto-assign-service.js` — motor activo en producción (JS legacy, 491 líneas)
- `src/services/assignment-engine.ts` — intento de migración TS, incompleto (usa `Profile` en vez de `Person`, no tiene LRA ni lógica de roles)

**Decisión cerrada**: `auto-assign-service.js` es el SSOT. No migrar hasta pedido explícito.

## Lógica Central

1. Cargar meeting + parts + persons activos
2. Filtrar por capacidades (`can_be_chairman`, `can_do_gems`, etc.)
3. Aplicar LRA (Last Recent Assignment) — evitar repetir a la misma persona
4. Asignar por orden de partes (chairman → prayer → tesoros → gems → lectura → estudiantes → CBS)
5. Saltar semanas con `assembly_type` (asamblea regional/circuito)

## Flags de Persona Relevantes

| Flag | Asignado a |
|---|---|
| `can_be_chairman` | Chairman |
| `can_do_prayers` | Oración inicial/final |
| `can_be_speaker` | Discurso Tesoros |
| `can_do_gems` | Perlas Espirituales |
| `can_do_bible_reading` | Lectura Bíblica |
| `can_do_student_parts` | Partes de estudiante |
| `can_be_assistant` | Ayudante de estudiante |
| `can_be_cbs_conductor` | Conductor CBS |
| `can_be_cbs_reader` | Lector CBS |

## Bugs Conocidos

1. **8/9 auto-assign**: CBS se asigna en `meetings.cbs_conductor_id` pero el conteo usa `meeting_parts.assigned_user_id` → contador visual confunde
2. **search=martinez devuelve 0**: `ilike` en `last_name`, pero algunos registros tienen nombre en `display_name`

## Ver también
- [[Arquitectura-Supabase]]
- [[Programs-Catalogo]]
