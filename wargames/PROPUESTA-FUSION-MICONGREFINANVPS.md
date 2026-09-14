# 🧬 PROPUESTA DE FUSIÓN — Repo único `micongrefinanvps`

**ID:** PROP-2026-002
**Creado:** 2026-09-12
**Estado:** 🟡 Propuesta para aprobación
**Relacionado:** `WARGAME-SYNC-VERCEL-VPS.md`, `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md`

---

## 🎯 Objetivo

Unificar los repositorios del linaje **VPS** en un único repositorio canónico llamado **`micongrefinanvps`**, que:

1. Corra en producción en `https://congregaciontj.duckdns.org/` (**VM211**, PROD).
2. Corra en `https://micongre.duckdns.org/` (**VM250**, LAB/demo) desde el **mismo código**, variando solo el perfil de despliegue.
3. Sea la **fuente única de verdad** del runtime self-hosted (SQLite + JWT).
4. Permita sincronizar fácilmente las mejoras portables hacia Vercel (`meeting-scheduler-pro@main`).

---

## 🔴 Problema actual (4 repos, 3 linajes, deploys peleando)

| Repo | Uso declarado | Problema |
|---|---|---|
| `meeting-scheduler-pro` (`main`) | Vercel | Congelado el 2026-07-22 |
| `meeting-scheduler-pro` (`vps-selfhosted`) | PROD VM211 | Repo compartido con Vercel: cualquiera puede desplegar la rama equivocada |
| `meeting-scheduler-pro-vps` (`vps-selfhosted`) | LAB VM250 | Divergente de PROD desde `a95e84d` |
| `micogre` | — | Checkpoint antiguo, ancestro; confunde |
| `congregaciontj` | KB + UI legacy | Fue desplegado por error en VM211 y pisó producción |

**Incidente ya ocurrido (2026-08-23):** `/opt/msp` tenía clonado `congregaciontj@main` (sin módulo Cuentas) y un build in-place pisó el deploy bueno. Raíz: **nadie sabía con certeza qué repo/rama correspondía a cada servidor**.

La fusión elimina esta ambigüedad: **1 repo = 1 runtime**.

---

## 🏗️ Arquitectura objetivo

### 1. Un solo repositorio, un solo linaje

```
micongrefinanvps (GitHub: oreyes100/micongrefinanvps)
├── main                      ← código canónico VPS (convergencia PROD+LAB)
├── release/prod              ← tag de lo desplegado en VM211
├── release/lab               ← tag de lo desplegado en VM250
└── vercel                    ← (fase 2) build Supabase para Vercel
```

### 2. Adapter de datos y auth (clave para no volver a forkear)

El port a VPS ya implementó un **shim compatible con supabase-js sobre SQLite** (`db.ts` ← `QueryBuilder`). Se promueve a un adapter formal seleccionado por entorno:

```
src/lib/data/
├── index.ts        getDataClient(): lee DB_DRIVER → sqlite | supabase
├── sqlite/
│   ├── db.ts       QueryBuilder (el actual)
│   └── sqlite.ts   getDb() better-sqlite3
└── supabase.ts     createClient() (Vercel)

src/lib/auth/
├── index.ts        getSessionContext(): lee AUTH_DRIVER → jwt | supabase
├── jwt.ts          verifySession() + cookie (VPS)
└── supabase.ts     createServerClient (Vercel)
```

- `crud.ts`: `sb()` → `getDataClient()`.
- `serverContext.ts`: `getSessionContext()` → provider.
- `supabase.ts` (browser): cliente real o stub según driver.
- `db.ts`/`sqlite.ts`/`schema.sql` viven **solo** en `sqlite/` → jamás entran al bundle de Vercel.

**Resultado:** el 90 % de features (`app/**`, `components/**`, `lib/export*.ts`) es compartido; Vercel y VPS dejan de divergir.

### 3. Perfiles de despliegue (mismo código, distinta config)

```
deploy/
├── profiles/
│   ├── prod-vm211.env       DB_PATH=/opt/msp/data/msp.db, PORT=3000, NODE_ENV=production
│   └── lab-vm250.env        DB_PATH=/opt/msp/data/msp.db, PORT=3010, NODE_ENV=production
├── ecosystem/
│   ├── prod-vm211.config.cjs
│   └── lab-vm250.config.cjs
└── scripts/
    ├── deploy-prod.sh        clon fresco + swap artefactos + PM2 (patrón deploy-msp.sh)
    └── deploy-lab.sh         pull + build + reload :3010

infra/
├── docker-web/               entry nginx+certbot (VM211)
└── nginx/                    vhosts duckdns (panel .34)
```

Variables diferenciadoras: `DB_PATH`, `PORT`, `AUTH_SECRET`, `SUPER_ADMIN_EMAILS`, `CUENTAS_*`, `TELEGRAM_*`.

> **Dos dominios, dos instancias:** `congregaciontj.duckdns.org` → VM211 (PROD, SQLite real) y `micongre.duckdns.org` → VM250 (LAB, SQLite de laboratorio). Mismo binario, distinta `DB_PATH`. Si se desea que ambos apunten a la **misma** base, usar el mismo `DB_PATH` por NFS/volumen (no recomendado: riesgo de corrupción SQLite en red).

### 4. Relación con Vercel

| Opción | Descripción | Recomendación |
|---|---|---|
| **A. Repos separados + adapter** | `micongrefinanvps` = VPS; `meeting-scheduler-pro@main` = Vercel. Sync de features portables vía cherry-pick (WG-2026-010) | ✅ **Ahora** (bajo riesgo) |
| **B. Un repo, dos ramas** | Vercel deploya `micongrefinanvps@vercel` (driver Supabase) | 🔜 Fase 2, tras estabilizar A |
| **C. Un repo, un deploy con `DB_DRIVER`** | Un solo branch; Vercel y VPS eligen driver por env | 🚫 No: Next.js en Vercel no puede cargar `better-sqlite3`/fs |

---

## 🔀 Estrategia de convergencia de ramas

Todos los heads comparten raíz (`61cbb62`) y los dos `vps-selfhosted` comparten ancestro (`a95e84d`, 2026-07-26). Por tanto **se pueden fusionar conservando historia**.

**Base recomendada:** `meeting-scheduler-pro@vps-selfhosted` (`52124a6`)
- Es la runtime real de PROD y tiene el superset de features confirmado (reports, print, proxy, health, cuentas, auto-assign, multi-tenant).

**Segundo linaje a integrar:** `meeting-scheduler-pro-vps@vps-selfhosted` (`24d3e90`)
- Aporta: fix SQLite (upsert compuesto, RETURNING, SyncStatus), `outgoing-speakers`, `cuentasTelegram` refactor, fix group-reports, fix iPad, restore atómico.

**Política de resolución de conflictos (34 archivos):**

| Archivo | Gana | Razón |
|---|---|---|
| `lib/db.ts` | **LAB** | Fix upsert compuesto/RETURNING es correctitud |
| `lib/schema.sql` | **LAB** | Esquema más nuevo |
| `api/cuentas/telegram/route.ts` + `lib/cuentasTelegram.ts` | **LAB** (lib) + puerto faltante de PROD | Consolidar: ruta delgada + lib completa |
| `app/api/cuentas/ocr/internal/route.ts` | **PROD** | LAB lo perdió |
| `proxy.ts`, `api/health/route.ts` | **PROD** | Más middleware/diagnóstico |
| `lib/api.ts` | **PROD** | LAB lo eliminó; confirmar si es dead code |
| `services/auto-assign-service.js` | **Conciliar** | PROD `d9bc196` vs LAB `5d45541`; test funcional |
| `components/cuentas/Reports.tsx` | **PROD** | Más lógica; verificar migración a lib en LAB |
| `app/outgoing-speakers/page.tsx` | **LAB** | Solo existe ahí |
| `components/TerritoryMap.tsx`, `territories/page.tsx` | **LAB** | Fix iPad más nuevo |
| `lib/s89Individual.ts` | **LAB** | Ajuste más nuevo |
| `app/group-reports/page.tsx`, `api/restore/route.ts`, `api/field-service-reports/route.ts` | **LAB** | Fix persistencia + restore atómico |
| `print/*`, `exportProgram.ts`, `exportS89.ts` | **PROD** (ya sincronizados) | Paridad confirmada |

---

## 📜 Runbook de fusión (paso a paso)

```bash
# 0. Prerrequisitos
gh auth status
git config --global user.name/user.email

# 1. Crear el repo nuevo (vacío) y clonar como base PROD
gh repo create oreyes100/micongrefinanvps --private
git clone https://github.com/oreyes100/micongrefinanvps.git
cd micongrefinanvps
git remote add prod https://github.com/oreyes100/meeting-scheduler-pro.git
git remote add lab  https://github.com/oreyes100/meeting-scheduler-pro-vps.git
git fetch --all

# 2. Traer toda la historia VPS como main
git checkout -b main prod/vps-selfhosted        # 52124a6
git push -u origin main

# 3. Fusionar el linaje LAB (24d3e90)
git merge lab/vps-selfhosted --allow-unrelated-histories
# Resolver los 34 archivos con la política de la sección anterior
git commit

# 4. Sanear el repo (quitar lo que ensucia/envía basura)
git rm -r --cached .claude-flow .claude/agents .claude/commands 2>/dev/null || true
git rm -r --cached supabase/.temp 2>/dev/null || true
# Revisar que .gitignore cubra: backups/, data/*.db, .next, node_modules

# 5. Adapter (Fase 1 de WG-2026-010)
#    Reorganizar src/lib/data y src/lib/auth; builds por driver

# 6. Verificar build de ambos perfiles
npm ci
DB_DRIVER=sqlite npm run build          # VPS
DB_DRIVER=supabase NEXT_PUBLIC_SUPABASE_URL=... npm run build   # Vercel (dry-run)

# 7. Tags de release
git tag release/prod/2026-09-12
git tag release/lab/2026-09-12
git push --tags
```

**Cutover (ventana de mantenimiento):**

1. Backup SQLite PROD y LAB.
2. En VM211: re-apuntar `/opt/msp` a `micongrefinanvps@main`, `npm ci && npm run build`, swap de artefactos, `pm2 restart`.
3. Verificar `https://congregaciontj.duckdns.org/api/health` = `{"ok":true}` + login + menú.
4. En VM250: idem con perfil lab (:3010). Verificar `https://micongre.duckdns.org`.
5. Actualizar `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` (repo↔servidor definitivo).

**Decomisión:**

| Repo | Acción |
|---|---|
| `micogre` | Archivar en GitHub (histórico, ancestro) |
| `meeting-scheduler-pro-vps` | Archivar tras el merge |
| `congregaciontj` | Mantener **solo como KB/docs**; prohibir desplegar en VM211 |
| `meeting-scheduler-pro` | Mantener `main` para Vercel; ramas `vps-selfhosted`/`windows-support` → congelar/conservar por historia |

---

## ✅ Acceptance Criteria de la fusión

- [ ] AC-1: Existe `oreyes100/micongrefinanvps` con la historia convergida y sin bucles de merge.
- [ ] AC-2: `main` compila para SQLite y para Supabase (adapter) con `DB_DRIVER`.
- [ ] AC-3: VM211 y VM250 despliegan desde el **mismo commit**, difieriendo solo en perfil/env.
- [ ] AC-4: `congregaciontj.duckdns.org` y `micongre.duckdns.org` responden `{"ok":true}` y permiten login.
- [ ] AC-5: Ningún artefacto VPS-only entra al build de Vercel.
- [ ] AC-6: Repos legacy archivados y documentación de topología actualizada.
- [ ] AC-7: Rollback documentado y probado (tag `release/*` previo).

---

## 📊 Riesgos

| Riesgo | Mitigación |
|---|---|
| Merge de 34 archivos con conflictos semánticos | Política por archivo + tests de paridad funcional antes del cutover |
| Perder fixes locales no pusheados del VPS | Bundle-selectivo previo (patrón `git bundle`) + diff contra `/opt/msp` |
| SQLite corrupto en cutover | Backup + `PRAGMA integrity_check` + restore probado |
| Dos instancias compartiendo `DB_PATH` por red | No compartir; cada instancia su DB |
| Vercel y VPS divergen de nuevo | Adapter + CI que corre el sync portable |

---

*Propuesta lista para aprobación. La ejecución debe acompañarse de `WARGAME-SYNC-VERCEL-VPS.md` para la parte Vercel.*
