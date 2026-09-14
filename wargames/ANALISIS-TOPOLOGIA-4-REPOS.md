# 🔍 ANÁLISIS DE TOPOLOGÍA — 4 repos, 3 linajes (MSP)

**ID:** RECON-2026-001
**Creado:** 2026-09-12
**Método:** clon fresco de los 4 remotos + fetch cruzado de todas las ramas + merge-base + diffs de contenido.

---

## 1. Repos y ramas (verificado)

| Repo | Rama | HEAD | Fecha | Commits |
|---|---|---|---|---|
| `oreyes100/meeting-scheduler-pro` | `main` | `54a88bf` | 2026-07-22 | 81 |
| `oreyes100/meeting-scheduler-pro` | `vps-selfhosted` | `52124a6` | 2026-09-01 | — |
| `oreyes100/meeting-scheduler-pro` | `windows-support` | `a7c06fb` | 2026-06-06 | — |
| `oreyes100/meeting-scheduler-pro-vps` | `main` | `a1ad45c` | 2026-08-22 | 90 |
| `oreyes100/meeting-scheduler-pro-vps` | `vps-selfhosted` | `24d3e90` | 2026-09-06 | — |
| `oreyes100/micogre` | `main` | `369058b` | 2026-07-24 | 87 |
| `oreyes100/congregaciontj` | `main` | `e8539f0` | 2026-09-01 | 98 |

Commit raíz compartido por los 4: **`61cbb62` — "Initial commit (clean)" — 2026-06-06**.

---

## 2. Grafo de linajes

```
61cbb62 (raíz, 2026-06-06)
  └─ … → 54a88bf (2026-07-22)  VERCEL main [congelado]
            │
            ├─ 3370309 feat(vps): migración completa a SQLite self-hosted
            ├─ be840cb fix(vps): rewrite routes … SQLite JOINs
            ├─ bc6c8b6 fix(meetings): explaining_beliefs ambos géneros   ← portable
            ├─ f68fbb7 fix(deploy): guía VPS
            │
            ├─ [rama micogre] acdc671 · 369058b (2026-07-24)  ← CHECKPOINT (ancestro de ambos VPS)
            │
            ├─ a95e84d (2026-07-26) ◄── punto de divergencia VPS
            │      │
            │      ├─ [PROD VM211] cuentas nativa, print, reports, multi-tenant …
            │      │      └─ 52124a6 (2026-09-01)  congregaciontj.duckdns.org
            │      │
            │      └─ [LAB VM250] 550c8d6 (iPad) → 61ef8c7 merge →
            │             49722a5 telegram → fe03076 backup → 10480da cuentas-v2 →
            │             … → 5db4fb6 outgoing → 24d3e90 (2026-09-06)  micongre.duckdns.org
            │
            └─ [congregaciontj main] diverge en f68fbb7 → e8539f0 (2026-09-01)
                     (KB/docs + snapshot UI; fue desplegado por error en VM211)
```

**Merge-bases**

| A ↔ B | Merge-base | Fecha |
|---|---|---|
| Vercel `main` ↔ PROD `vps-selfhosted` | `54a88bf` | 2026-07-22 |
| PROD `vps-selfhosted` ↔ LAB `vps-selfhosted` | `a95e84d` | 2026-07-26 |
| LAB `vps-selfhosted` ↔ `congregaciontj/main` | `550c8d6` | 2026-08-18 |
| `micogre/main` ↔ PROD/LAB | `369058b` | 2026-07-24 |
| Vercel `main` ↔ LAB `vps-selfhosted` | `54a88bf` | 2026-07-22 |

---

## 3. Mapeo repo ↔ entorno (según KB + verificación)

| Entorno | URL | Repo/rama desplegada | Runtime |
|---|---|---|---|
| Vercel | meeting-scheduler-pro.vercel.app | `meeting-scheduler-pro@main` (`54a88bf`) | Next.js serverless + Supabase cloud |
| PROD VM211 | congregaciontj.duckdns.org | `meeting-scheduler-pro@vps-selfhosted` (`52124a6`) | PM2 :3000 + nginx :80 + SQLite |
| LAB VM250 | micongre.duckdns.org | `meeting-scheduler-pro-vps@vps-selfhosted` (`24d3e90`) | PM2 :3010 + nginx proxy + SQLite |
| — | — | `micogre@main`, `congregaciontj@main` | Histórico / KB |

**Nota de naming (fuente de confusión histórica):** la VM211 se llama internamente "micongre", pero su dominio público es `congregaciontj.duckdns.org`; y `micongre.duckdns.org` apunta en realidad al **LAB** (VM250). El nombre del servidor NO coincide con el dominio.

---

## 4. Arquitectura de datos

| | Vercel | VPS |
|---|---|---|
| Motor | Supabase (Postgres) | SQLite (`better-sqlite3`) |
| Cliente datos | `@supabase/supabase-js` | `dbClient()` (shim QueryBuilder en `db.ts`) |
| Auth | Supabase Auth (cookies SSR) | JWT propio (`jose`) + bcrypt, cookie |
| Sesión | `serverContext` → `createServerClient().auth.getUser()` | `verifySession()` + SELECT en `users` |
| Acceso genérico | `crud.ts: sb()` → `createClient()` | `crud.ts: sb()` → `dbClient()` |
| Deploy | Vercel | Next standalone + PM2 |
| Dependencias extra | — | `better-sqlite3`, `bcryptjs`, `jose` |

`db.ts` implementa `.from().select().eq().neq().in().gte().lte().like().or().is().order().limit().single().maybeSingle().insert().update().upsert().delete()` sobre SQLite, devolviendo `{ data, error }` con la forma de supabase-js. **Es la pieza que hace viable unificar.**

---

## 5. Volumetría

| Comparación | Resultado |
|---|---|
| Vercel `main` → PROD `vps-selfhosted` | 443 archivos, +108102 / −1089 (mayoría PDFs/artefactos) |
| PROD → LAB (`src/`) | 34 archivos, +1459 / −914 |
| LAB → `congregaciontj/main` | 102 archivos, +2341 / −10677 |
| Commits solo en Vercel (no en VPS) | **0** → VPS es superset de commits |
| Commits solo en PROD (vs LAB) | ~57 (muchos re-implementados) |
| Commits solo en LAB (vs PROD) | 18 |

**Heads vivos (verificación HTTP 2026-09-12):** las 3 URLs responden `307 → /login` y `/api/health = {"ok":true}`.

---

## 6. Features presentes solo en VPS (no en Vercel)

Páginas: `cuentas-v2`, `messaging`, `telegram`.
APIs: `auth/login|logout`, `cuentas/*` (12 rutas), `messages`, `messaging-settings`, `telegram-settings(/test)`, `super-admin/replication|system`, `territory-assignments(/[id])`, `territory-notifications/run`, `congregation/boundary`.
Libs: `db.ts`, `sqlite.ts`, `schema.sql`, `auth.ts`, `exportProgram.ts`, `exportS89.ts`, `s89Individual.ts`, `messaging.ts`, `telegram.ts`, `touch.ts`, `useDevice.ts`, `theme.tsx`, `printReport.ts`.
Infra: `deploy/vps/*`, `infra/docker-web/*`, `server.js`, `ecosystem.config.example.cjs`, `.github/workflows/deploy.yml`, scripts sqlite.

---

## 7. Conclusión

1. **Vercel está ~10 semanas atrás** y sin hardening de seguridad → riesgo alto.
2. **PROD y LAB divergieron** y re-implementaron features; hay que reconciliar por contenido (34 archivos), no por commits.
3. **La arquitectura ya es adapter-friendly** (shim `dbClient()`), lo que permite un repo único con `DB_DRIVER` y elimina la causa raíz de la deriva.
4. Recomendación: ejecutar `WARGAME-SYNC-VERCEL-VPS.md` y `PROPUESTA-FUSION-MICONGREFINANVPS.md` en ese orden (primero adapter, luego fusión).

---

*Evidencia reproducible con: clonar los 4 remotos, `git fetch --all`, `git merge-base`, `git diff --numstat` entre heads. Ver `WARGAME-SYNC-VERCEL-VPS.md` para el plan de acción.*
