# Sincronización con Supabase

Patrón de datos entre cliente Next.js y backend Supabase PostgreSQL.

## Capas de Cliente

| Capa | Librería | Propósito |
|---|---|---|
| Auth SSR | `@supabase/ssr` | Cookies Next.js para sesión |
| Cliente | `@supabase/supabase-js` | Queries directas |
| Server State | `@tanstack/react-query` | Caching y revalidación |
| Estado local | `zustand` | UI state client-side |

## Route Handlers (API)

Endpoints en `src/app/api/`:
- `meetings/` — CRUD reuniones entre semana
- `persons/` — CRUD publicadores + filtros
- `users/` — autenticación y perfiles

## Edge Functions

PDF generation via `@react-pdf/renderer` (worker thread → Blob download).
Email notifications via Resend (triggered by webhook o route handler).

## Seguridad

- RLS policies: toda query incluye `WHERE congregation_id = auth.congregation_id()`
- Service role key solo en server-side (`auto-assign-service.js`)
- Row-level security por defecto en todas las tablas

## Ver también
- [[Arquitectura-Supabase]]
- [[Auto-Asignacion]]
