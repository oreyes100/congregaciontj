# 🏁 CIERRE — Convergencia y Sincronización MSP

**Fecha:** 2026-09-14
**Estado:** ✅ Fases 1–4 completadas (validación funcional con login pendiente)
**Repos canónicos:**
- VPS: [`oreyes100/micongrefinanvps`](https://github.com/oreyes100/micongrefinanvps) — `main` = `b553469`
- Vercel: `oreyes100/meeting-scheduler-pro` — `main` = `e67fe34`

---

## 1. Resumen ejecutivo

Se partía de **4 repos y 3 linajes divergentes** del mismo producto, con Vercel congelado ~10 semanas atrás, dos VPS (PROD y LAB) re-implementando features en paralelo y sin hardening en Vercel. El resultado:

1. **Fusión VPS** → un único repo `micongrefinanvps` (convergencia PROD VM211 + LAB VM250).
2. **Cutover** de ambos VPS al repo fusionado, sin incidentes y con datos intactos.
3. **Adapter Pattern** (`DB_DRIVER`/`AUTH_DRIVER`) para que un mismo `src/` compile para SQLite y Supabase.
4. **Sync Vercel** → 7 PRs que llevan a producción las mejoras portables (seguridad, features, reportes, mensajería) sin arrastrar la capa self-hosted.

---

## 2. Topología final

| Entorno | URL | Repo / rama | Runtime |
|---|---|---|---|
| Vercel | meeting-scheduler-pro.vercel.app | `meeting-scheduler-pro@main` | Next.js + Supabase (Postgres) |
| PROD VM211 | congregaciontj.duckdns.org | `micongrefinanvps@main` | PM2 fork :3000 + nginx :80 + SQLite |
| LAB VM250 | micongre.duckdns.org | `micongrefinanvps@main` | PM2 fork :3010 + SQLite |

- Ambos VPS despliegan **el mismo commit** (`b553469`), con perfiles distintos (`.env`/ecosystem).
- Supabase compartido por Vercel: proyecto `hkenemrbaullpqklphsv`.
- **LB/elección de datos:** el shim `db.ts` emula la API de supabase-js sobre SQLite; el adapter elige driver por entorno.

---

## 3. Fase 2 — Fusión VPS (`micongrefinanvps`)

- **Raíz común** de los 4 repos: `61cbb62`. PROD/`vercel/vps-selfhosted` (`52124a6`) y LAB/`meeting-scheduler-pro-vps@vps-selfhosted` (`24d3e90`) divergían desde `a95e84d`.
- **Merge** `c569974`: 9 conflictos resueltos (34 archivos, +1729/−676).
  - LAB: `db.ts`/`sqlite.ts`/`schema.sql`/`s89Individual`/`backupSections`.
  - PROD: `proxy.ts`, `health` diagnóstico, `lib/api.ts`, comentario en `assign`.
  - Consolidado: `cuentas/page` → redirect a `/cuentas-v2`; `telegram/route` → ruta delgada + `lib/cuentasTelegram.ts`; `PrintModal` "Semana del miércoles"; `auto-assign` default `sb()`.
- **Saneo** `2aa5bfd`: −198 artefactos (`.claude-flow`, `.claude/agents`, `supabase/.temp`, `.swarm`, `ruvector.db`, `*.bak`).
- **Fix** `b553469`: `.gitignore` `data/` atrapaba `src/lib/data/` → anclado a `/data/`.

### Auto-assign — Opción C (`379bccf`)
Dos estrategias de Student Parts bajo `AUTO_ASSIGN_DRIVER`:
- `strict` (default) = PROD (persiste `student_part_type='talk'`, LRA por tipo, `is_elder`/`is_ministerial_servant`).
- `legacy` = LAB.
- Ambas verificadas idénticas a sus originales.

---

## 4. Fase 3 — Cutover VPS

**Ejecutado 2026-09-12.** Tags `release/prod/2026-09-12` y `release/lab/2026-09-12`.

| | VM211 PROD | VM250 LAB |
|---|---|---|
| HEAD | `b553469` | `b553469` |
| PM2 | **fork** (era cluster) :3000 | fork :3010 |
| `health/deep` | ok · sqlite · all_present | ok · sqlite · all_present |
| Datos | meetings 42 · users 97 · territories 11 | meetings 42 · users 98 · territories 16 |
| Acceso git | deploy key read-only `VM211-prod` | deploy key read-only `VM250-lab` |

**Backups verificados:** `msp-2026-09-12.db` (PROD), `msp-lab-20260912.db` (LAB), `integrity_check = ok`.

### Incidentes resueltos durante el cutover
1. `src/lib/data/` fuera del commit (`.gitignore data/`) → build abortó **antes del swap**; fix `b553469`.
2. VM250: `standalone/` obsoleto rompía el typecheck → eliminado.
3. VM250: `npm install` → `ERR_INVALID_ARG_TYPE` → resuelto con `npm ci`.
4. `schema.sql` no se copiaba en el swap de PROD → añadido al deploy script (`scripts/deploy-vps.sh`).
5. Scripts `/opt/deploy-msp.sh` y `/opt/deploy_update.sh` re-apuntados a `micongrefinanvps@main`.

**Estabilidad:** 3 checklists (T+0, ~10 h, ~30 h) en verde: 0 `SQLITE_BUSY`, 0 errores auth, `quick_check` ok. **Cron del LAB reactivado** tras >24 h estables.

> Hallazgo colateral: la LAB previa no tenía `.lt/.gt` en el shim → la rotación de limpieza del auto-assign fallaba. La fusión lo corrigió.

---

## 5. Fase 1 — Adapter Pattern

Rama `feat/adapter-fase1` (commit `4099633`), `main` intacto entonces.

- `src/lib/data/index.ts` → `getDataClient()`: `DB_DRIVER=sqlite` (default, shim) | `supabase`.
- `src/lib/auth/index.ts` → `getSessionContext()`: `AUTH_DRIVER=jwt` | `supabase` (deriva de `DB_DRIVER` si no se especifica).
- `crud.ts` `sb()` → `getDataClient()` (sin tocar 47 call sites).
- `serverContext.ts` = fachada + `canAccessCuentas` (VPS-only).
- `better-sqlite3` **carga perezosa** (`createRequire` dentro de `getDb()`) + `serverExternalPackages` → no entra al runtime Vercel.
- Edge-safe: `auth/index` no importa la capa de datos (lee `DB_DRIVER` del entorno).
- **Gate:** `next build` OK con `DB_DRIVER=sqlite` y `=supabase`.

---

## 6. Fase 4 — Sync Vercel (PRs #1–#7)

Método: cherry-pick selectivo + adaptación sobre versiones Supabase; preview + producción con rollback de Vercel.

| PR | Commit | Contenido |
|---|---|---|
| #1 | — | **P0 seguridad**: `proxy.ts` default-deny en `/api` (allowlist `health`, `resolve-login`); scoping `congregation_id` en auto-assign. |
| #2 | — | **P1**: Programas JW Sep/Oct-2026 (corrige clave duplicada `2026-09-14`) + motor auto-assign corregido. |
| #3 | — | **P1b**: `explaining_beliefs` (ambos géneros/ayudante opcional) + territorios iPad/WebKit + capa táctil. |
| #4 | — | **P1c**: suite print/reportes (`exportProgram`/`exportS89`/`s89Individual`/`PrintModal`) + `xlsx-js-style`. |
| #5 | — | **P1d**: responsabilidades/organigrama (página + API `congregation-roles` sobre Supabase). |
| #6 | `a2aa38c` | **P1e**: mensajería (WhatsApp) + Telegram (libs/rutas/páginas/módulos) + `notify` en asignación. |
| #7 | `e67fe34` | **P1f**: cron de avisos vencido/semanal + Vercel Cron. |

**Efecto P0 medido:** `GET /api/users` sin sesión pasó de **200 con la lista completa** a **401**.

### Infra tocada en Fase 4
- **Vercel env** (scope Preview, branch `sync/vps-improvements`): 5 vars Supabase + `CRON_SECRET`. `CRON_SECRET` también en Production.
- **Supabase migración aplicada** `20260914000000_messaging.sql`: tablas `messages` + `messaging_settings`.
- **`vercel.json`**: cron `0 15 * * *` (09:00 CST) → `/api/territory-notifications/run`.

### Verificación post-deploy (todas las tandas)
`/api/health` 200 · `/api/users` 401 · `/api/congregation-roles` 401 · `/api/messages` 401 · `/api/messaging-settings` 401 · `/api/telegram-settings` 401 · `/api/territory-notifications/run` 401 sin auth · `/login` 200 · capa táctil (`touch-device`) presente en el HTML.

---

## 7. Rollback

| Entorno | Procedimiento |
|---|---|
| VPS | Re-apuntar `/opt/msp` al commit del tag `release/prod/2026-09-12` (o `72a0a58`) + `npm ci && npm run build` + `pm2 restart`. Backups SQLite disponibles. |
| Vercel | `vercel rollback` al deployment anterior, o revertir el PR en `main` (redeploy instantáneo). |

---

## 8. Pendientes y matices

1. **Validación funcional con login** (no ejecutada): asignar territorio → aviso en `/messaging`; `Telegram → Enviar prueba`; export/print; organigrama.
2. **App móvil (Capacitor)**: si llama a la API con `Authorization: Bearer` y no cookie, el middleware no verá la sesión → 401. La web usa cookies SSR. Probar en móvil.
3. **Telegram en asignación**: hoy solo plataforma + WhatsApp (igual que VPS); Telegram se usa desde su página de configuración.
4. **`congregation_roles` en Supabase**: PK `role_key` (no compuesto) → multi-congregación real requiere migración de PK.
5. **Rutas VPS-only**: las 18 rutas portables con SQL crudo (`getDb`) siguen VPS-only; Vercel usa sus versiones Supabase. Ver `PLAN-MAESTRO §10`.
6. **Seguridad heredada (KB VPS)**: rotar credenciales expuestas (pfSense/pve/VMs) y `ai_api_key` en exports.
7. **LAN ↔ dominio (hairpin NAT)**: incidencia de red independiente de la app (pfSense); pendiente de revisión de NAT reflection.

---

## 9. Operación

```bash
# VPS PROD / LAB — deploy manual
/opt/deploy-msp.sh              # PROD (VM211): clon fresco + swap + PM2
/opt/deploy_update.sh           # LAB (VM250): pull + build + reload (también por cron */15)
/opt/msp/backup.sh              # backup SQLite diario
sqlite3 /opt/msp/data/msp.db "PRAGMA integrity_check;"

# Verificación
curl -s localhost:3000/api/health/deep      # PROD
curl -s localhost:3010/api/health/deep      # LAB

# Vercel
vercel ls meeting-scheduler-pro             # deployments
vercel env ls                               # env vars
supabase db query --linked --file supabase/migrations/<archivo>.sql

# Rollback VPS
cd /opt/msp && git fetch && git checkout <tag-o-commit> && npm ci && npm run build && pm2 restart meeting-scheduler-pro
```

---

## 10. Documentos relacionados (KB)

- `PLAN-MAESTRO-CONVERGENCIA-MSP.md` — plan y §8–§13 (estado de ejecución).
- `WARGAME-SYNC-VERCEL-VPS.md` — backlog portable y exclusiones VPS-only.
- `PROPUESTA-FUSION-MICONGREFINANVPS.md` — arquitectura y runbook de fusión.
- `ANALISIS-TOPOLOGIA-4-REPOS.md` — evidencia de linajes.
- `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` — accesos y topología de red (KB VPS).

---

*Cierre de proyecto: convergencia VPS completada, cutover sin incidentes, adapter formalizado y Fase 4 de sincronización con Vercel completada (7 PRs). Validación funcional con login queda como último paso de aceptación.*
