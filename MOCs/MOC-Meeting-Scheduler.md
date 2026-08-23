# MOC - Meeting Scheduler Pro

Mapa de contenido del proyecto. Navegación temática entre Wiki y código fuente.

## Stack Técnico
- [[Arquitectura-Supabase]] — Schema, RLS, multi-tenancy
- [[Sync-Supabase]] — Patrón de datos cliente ↔ servidor

## Dominio del Negocio
- [[Programs-Catalogo]] — Programas JW (hardcoded en `programs.ts`)
- [[Sesion-Semanal]] — Estructura de la reunión y componentes UI
- [[Auto-Asignacion]] — Motor de asignación automática

## Archivos Clave del Código
- `src/lib/programs.ts` — Catálogo de programas (SSOT)
- `src/services/auto-assign-service.js` — Motor activo de asignación
- `src/types/index.ts` — Tipos: Person, MeetingPart, Program
- `src/components/MeetingDashboard.tsx` — Formulario principal
- `src/components/Sidebar.tsx` — Navegación
- `src/components/PrintModal.tsx` — Impresión (paleta La Estación)
- `src/app/meetings/` — Páginas de reuniones entre semana
- `src/app/weekend/` — Páginas de reunión fin de semana
- `src/app/persons/` — CRUD publicadores
- `src/app/territories/` — Mapa Leaflet con polígonos

## Memoria del Proyecto
- `.claude/memory/CONTEXTO.md` — Estado activo sesión a sesión
- `.claude/memory/Decision Journal.md` — Decisiones arquitectónicas cerradas
- `.claude/memory/learned-rules.md` — Reglas aprendidas
- `.claude/memory/sessions.jsonl` — Historial de sesiones

## Metodologías Activas
- Session Efficiency (permanente) — JIT Context Loading, prompt denso
- Persistent Context (permanente) — Boot/Close, memoria entre sesiones
- Plan First (condicional) — >3 archivos → plan antes de ejecutar

## Ver también
- [[Arquitectura-Supabase]]
- [[Auto-Asignacion]]
