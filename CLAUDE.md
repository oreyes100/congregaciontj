@AGENTS.md

# CLAUDE.md — Meeting Scheduler Pro

## Rol del Agente
Co-desarrollador. Implementa features, corrige bugs, refactoriza. No toma decisiones de UX sin confirmación.

## Stack Técnico
- **Framework**: Next.js (App Router) — leer `node_modules/next/dist/docs/` ante APIs dudosas
- **BD**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Estilos**: Tailwind CSS
- **Lenguaje**: TypeScript (src/) + JavaScript (scripts/, servicios legacy)
- **Deploy**: Vercel

## Contexto del Proyecto
Planificador de reuniones de congregación Testigos de Jehová (Vida y Ministerio Cristianos). Reemplaza "New World Scheduler". Gestiona asignación de partes semanales a publicadores con auto-asignación por disponibilidad.

## Arquitectura Clave
```
src/
  app/api/          ← Route Handlers Next.js (meetings, persons, users)
  components/       ← MeetingDashboard, MeetingOverview, PrintModal, Sidebar
  lib/
    programs.ts     ← PROGRAMS[monday] — catálogo de partes semanales (hardcoded, SSOT)
    supabase.ts     ← cliente Supabase
  services/
    auto-assign-service.js  ← motor de asignación ACTIVO en producción (Decision Journal 2026-06-13)
    assignment-engine.ts    ← TypeScript, incompleto (sin LRA/roles) — no usar sin migración explícita
  types/index.ts    ← Person, MeetingPart, Program, PartType, etc.
```

## Tablas Supabase Principales
- `meetings` — una fila por semana; campos: date, chairman_id, songs, cbs_conductor_id, cbs_reader_id
- `meeting_parts` — partes individuales con assigned_user_id
- `persons` — publicadores con flags de capacidad (can_be_chairman, can_do_gems, etc.)

## Restricciones Permanentes
- **No commitear sin confirmación explícita.**
- **No crear archivos .md** salvo que el usuario los pida.
- **No agregar features** más allá de lo pedido.
- **No manejar errores** para escenarios imposibles — solo validar en boundaries reales.
- **No tocar** `src/lib/programs.ts` para agregar semanas sin confirmación (cambio manual deliberado).
- Si tarea afecta **>3 archivos** → exponer plan antes de editar.
- Antes de acción destructiva (reset, drop, rm): confirmar con usuario.
- **`git push` a producción: ejecutar sin preguntar** — el usuario ya hizo pruebas antes de pedir el push.
- **Congregación**: "La Estación" (constante en PrintModal.tsx → `CONGREGATION_NAME`).

## Vault de Conocimiento (Fuente de Metodología)
Este proyecto está anidado dentro del vault Obsidian (`../` desde esta carpeta). Cargar JIT — nunca releer `Wiki/` completo (614+ notas), solo lo listado abajo:
- Governance base: `../Meta/CLAUDE.md`, `../Meta/core-invariants.md`
- Índice de drivers disponibles: `../Meta/METHODOLOGIES_INDEX.md`
- **Driver activo para features que replican NWS Desktop**: SDD (Spec Driven Development) — extraer spec real de `../New World Scheduler/ProgramData/A/*.json` antes de codear; nunca adivinar comportamiento legacy.
- Persistent Context y Plan First ya están activos de facto (`.claude/memory/`, invariante >3 archivos abajo) — no requieren nueva configuración.

## Protocolo `/close` (cierre de sesión)
Cuando el usuario escriba `/close` (o "cierra sesión"), ejecutar el cierre de Persistent Context:
1. Actualizar `.claude/memory/Contexto Activo.md`: mover "Última Sesión" a "Sesión Anterior", registrar completado/pendiente/próximos pasos de esta sesión, actualizar fecha del pie.
2. Si hubo decisiones arquitectónicas nuevas → agregar entrada en `.claude/memory/Decision Journal.md` (formato: Contexto / Decisión / Por qué / Alternativa descartada / Estado).
3. Append en `.claude/memory/sessions.jsonl`: `{"date":"YYYY-MM-DD","session_n":N,"summary":"...","score":1-10}` (score = autoevaluación de la sesión).
4. NO commitear como parte del cierre (regla de confirmación explícita aplica igual).
5. Responder solo con un resumen de 3-5 líneas de lo registrado.

## Formato de Output
- Respuestas concisas. Sin intro genérica.
- Sin summary al final.
- Código: siempre con path del archivo. Sin comentarios obvios.
- Errores: citar exacto el mensaje, no parafrasear.

## Comandos de Referencia
- `npm run dev` — servidor local en puerto 3000
- `node seed_test_users.js` — poblar BD con usuarios de prueba
- `node createTestMeeting.js` — crear reunión de prueba
