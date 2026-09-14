# 🎯 WARGAME: Sincronización Vercel ↔ VPS (MSP)

**ID:** WG-2026-010
**Creado:** 2026-09-12
**Estado:** 🟡 PLANIFICADO (listo para ejecución)
**Severidad:** HIGH (deriva de código / features atrapadas en VPS)
**Categoría:** Sincronización de código multi-repo · Deuda técnica · Seguridad
**Relacionados:** `WARGAME-LOST-GROUP-REPORTS.md`, `PROPUESTA-FUSION-MICONGREFINANVPS.md`, `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md`

---

## 📋 Executive Summary

Existen **4 repositorios y 3 linajes** del mismo producto (`meeting-scheduler-pro`). Todos parten del commit raíz **`61cbb62` (2026-06-06)**. El linaje Vercel quedó **congelado el 2026-07-22 (`54a88bf`)**, mientras el linaje VPS acumuló ~70 commits de features, correcciones y hardening. Además, los dos despliegues VPS (**PROD VM211** y **LAB VM250**) **divergieron entre sí desde `a95e84d` (2026-07-26)** y re-implementaron features en paralelo con hashes distintos.

**Objetivo del wargame:**
1. Subir a Vercel (`meeting-scheduler-pro@main`) todas las **mejoras portables** que ya están en producción VPS (PROD + LAB), sin arrastrar la capa SQLite/self-hosted.
2. Analizar y aplicar a **`micongre.duckdns.org` (LAB)** las mejoras de **`congregaciontj.duckdns.org` (PROD)** que no llegaron al LAB.
3. Sentar la base para la fusión de repos VPS en `micongrefinanvps` (ver propuesta aparte).

> ⚠️ **Hallazgo crítico de seguridad**: Vercel corre hoy **sin autenticación en ~47 rutas API** y sin rate-limit. El hardening existe solo en VPS (`369058b`). Es el item de mayor prioridad.

---

## 🗺️ Topología real (evidencia verificada)

| Entorno | URL | Repo | Rama | HEAD | Fecha | Rol |
|---|---|---|---|---|---|---|
| Vercel | meeting-scheduler-pro.vercel.app | `meeting-scheduler-pro` | `main` | `54a88bf` | 2026-07-22 | Original (Supabase cloud) |
| PROD VPS | congregaciontj.duckdns.org | `meeting-scheduler-pro` | `vps-selfhosted` | `52124a6` | 2026-09-01 | Producción VM211 (SQLite) |
| LAB VPS | micongre.duckdns.org | `meeting-scheduler-pro-vps` | `vps-selfhosted` | `24d3e90` | 2026-09-06 | Lab VM250 (SQLite) |
| Snapshot VPS | — | `micogre` | `main` | `369058b` | 2026-07-24 | Checkpoint antiguo (ancestro de ambos VPS) |
| KB/Docs | — | `congregaciontj` | `main` | `e8539f0` | 2026-09-01 | Base de conocimiento + snapshot UI legacy |

**Merge-bases verificados**

```
raíz común:                    61cbb62 (2026-06-06)
Vercel main   ↔ PROD vps-self: 54a88bf (2026-07-22)  ← Vercel quedó atrás
PROD          ↔ LAB vps-self:  a95e84d (2026-07-26)  ← divergencia VPS
LAB           ↔ congregaciontj:550c8d6 (2026-08-18)
micogre/main  es ancestro de ambos vps-selfhosted (merge-base = 369058b)
```

**Volumetría de divergencia**

| Comparación | Archivos | Δ |
|---|---|---|
| Vercel `main` vs PROD `vps-selfhosted` | 443 | +108102 / −1089 (incluye PDFs y artefactos) |
| PROD vs LAB `vps-selfhosted` (solo `src/`) | 34 | +1459 / −914 |
| Commits solo en PROD (no en LAB) | ~57 | (muchos re-implementados en LAB) |
| Commits solo en LAB (no en PROD) | 18 | |

Las tres URLs responden `307 → /login` y `{"ok":true}` en `/api/health`.

---

## 🧠 Arquitectura que hace posible la sincronización

El port a VPS **NO forkó la lógica de negocio**: introdujo un **shim compatible con supabase-js sobre SQLite**.

```
Vercel                                    VPS
─────────────────────────────             ─────────────────────────────
crud.ts:  sb() = createClient()           crud.ts:  sb() = dbClient()
                                                        │
                                          db.ts: QueryBuilder que emula
                                          .from().select().eq().order()
                                          .insert().update().upsert().delete()
                                          sobre better-sqlite3
                                          (devuelve { data, error })
```

**Consecuencia estratégica:** el 90 % del código de features (`src/app/**`, `src/components/**`, `src/lib/export*.ts`) es **agnóstico al motor de datos**. Solo difieren 3 puntos:
1. `src/lib/crud.ts` → `sb()`
2. `src/lib/serverContext.ts` → sesión (Supabase Auth vs JWT cookie)
3. `src/lib/supabase.ts` → cliente browser (real vs stub)

Esto permite sincronizar features entre Vercel y VPS **sin reescribirlas**, siempre que primero se formalice un **adapter por variable de entorno**.

---

## 🧪 Método de sincronización (evita merges masivos)

No usar `git merge` de ramas completas (arrastraría `better-sqlite3`, scripts, deploys, PDFs). Usar **cherry-pick selectivo + adapter**:

```bash
# En un clon limpio de meeting-scheduler-pro (repo Vercel)
git remote add prod https://github.com/oreyes100/meeting-scheduler-pro.git
git remote add lab  https://github.com/oreyes100/meeting-scheduler-pro-vps.git
git fetch --all

# Traer SOLO el commit portable (ejemplo: programs Sep-2026)
git cherry-pick -x e910399        # prod/vps-selfhosted
# o, si el hash es de LAB:
git cherry-pick -x 358dd16

# Si el commit mezcla infra + feature, usar:
git checkout prod/vps-selfhosted -- src/lib/programs.ts
```

Regla de oro: **un commit por feature, con `-x`, verificando que no toque `db.ts`, `sqlite.ts`, `auth.ts`, `schema.sql`, `deploy/`, `infra/`, `next.config.*`**.

---

## 📦 Backlog portable (VPS → Vercel) — ordenado por prioridad

| # | Mejora | Commits (PROD / LAB) | Archivos clave | Riesgo | Notas |
|---|---|---|---|---|---|
| P0 | **Auth guard 47 rutas + rate-limit login + panel superadmin** | `369058b` / (implícito) | 47 `route.ts`, `login/route.ts`, `lib/auth.ts` | 🔴 Alto | Vercel usa Supabase Auth: portar como verificación de sesión server-side, no JWT casero |
| P0 | **Scoping estricto por `congregation_id`** en `GET /api/users` y auto-assign + fix crash `/super-admin` | `52124a6` / `330009b` | `api/users/route.ts`, `super-admin/page.tsx`, `services/auto-assign-service.js` | 🔴 Alto | Multi-tenant: fuga de datos entre congregaciones |
| P0 | **AUTH_SECRET/edge middleware/zod v4** (seguridad S15) | `ddd3045` | `proxy.ts`, `package.json` | 🟠 Medio | zod v4 + middleware edge |
| P1 | **Auto-assign**: correcciones del motor + regla "no reusar en el mes" | `d9bc196`, `f39f8cd` | `services/auto-assign-service.js` | 🟠 Medio | Motor real en producción |
| P1 | **Programas JW Sep-2026** (incl. 4 partes de estudiante Sep 14-20) | `e910399` / `358dd16` | `lib/programs.ts` | 🟢 Bajo | Datos puros |
| P1 | **Reportes**: paginación dinámica PDF, alto contraste Presidente/Oración, paridad XLSX/DOCX | `9a1246c` / `ae63916` | `lib/exportProgram.ts`, `components/PrintModal.tsx` | 🟢 Bajo | Ya sincronizado entre VPS |
| P1 | **Print suite**: PDF/DOCX/XLSX con layout impreso; hojas S-89 individuales 85 mm; reporte publicadores | `9dc308f`, `d161fca`, `04798fa`, `e3214be`, `439d167`, `de9450f`, `e671260`, `e2feaf3`, `47c8688` | `lib/exportProgram.ts`, `exportS89.ts`, `s89Individual.ts`, `printReport.ts`, `PrintModal.tsx` | 🟢 Bajo | Mayor bloque de valor; puro front/lib |
| P2 | **Territorios iPad/WebKit** (ResizeObserver, tap, flex) | `4562466`, `1d9af13` | `components/TerritoryMap.tsx`, `territories/page.tsx` | 🟢 Bajo | |
| P2 | **Capa táctil iPhone/iPad/Android** | `2371282` | `lib/touch.ts`, `lib/useDevice.ts`, `globals.css`, `layout.tsx`, `IconSidebar.tsx` | 🟢 Bajo | |
| P2 | **Módulo Mensajería + WhatsApp y avisos por plataforma** | `bba0a0e` + `api/messages`, `messaging-settings` | `app/messaging/page.tsx`, `lib/messaging.ts` | 🟠 Medio | Requiere adapter de datos |
| P2 | **Sincronización Telegram** (avisos de territorios) | `275…?` / `api/telegram-settings` | `app/telegram/page.tsx`, `lib/telegram.ts` | 🟠 Medio | Requiere adapter |
| P2 | **Fix persistencia informes de grupo** | `e8fc0d9` / `24d3e90` | `group-reports/page.tsx`, `api/field-service-reports/route.ts` | 🟠 Medio | Ver WG-2026-009 |
| P3 | **`explaining_beliefs` permite ambos géneros + ayudante opcional** | `bc6c8b6` | `components/MeetingDashboard.tsx` | 🟢 Bajo | |
| P3 | **Responsabilidades / organigrama + roles de congregación** | `33040f2`, `congregation-roles` | `app/responsibilities/page.tsx`, `api/congregation-roles/route.ts` | 🟢 Bajo | |
| P3 | **Discursantes salientes** (`outgoing-speakers`) + fecha miércoles | `5db4fb6` | `app/outgoing-speakers/page.tsx`, `api/outgoing-talks/*`, `s89Individual.ts` | 🟠 Medio | Solo LAB; no en PROD |

### ❌ Excluido explícitamente de Vercel (VPS-only, no portable)

- `src/lib/db.ts`, `src/lib/sqlite.ts`, `src/lib/schema.sql` (SQLite)
- `src/lib/auth.ts` + `api/auth/login|logout` (JWT cookie propio)
- `scripts/export-supabase-to-sqlite.cjs`, `scripts/import-to-sqlite.cjs`, `scripts/create-admin.cjs`
- `deploy/`, `infra/`, `server.js`, `ecosystem.config.*`, `next.config` (`output: standalone`)
- `.github/workflows/*` (deploy VPS)
- **Cuentas v2 nativa**: `app/cuentas-v2/**`, `api/cuentas/**`, `lib/cuentasTelegram.ts`, `lib/pdf-templates/*.pdf`, OCR Gemini, backup/restore SQLite. En Vercel, Cuentas sigue como **iframe** (`cuentas-congregacion-bay.vercel.app`).
- `app/api/backup|restore`, `super-admin/replication|system` (dependen de FS/SQLite)

---

## 🔁 Gap PROD → LAB (mejoras de `congregaciontj.duckdns.org` no aplicadas a `micongre.duckdns.org`)

Diferencias de contenido reales en `src/` (dirección PROD → LAB; `+` = existe en LAB, `−` = existe en PROD y falta en LAB):

| Archivo | Δ (+/−) | Interpretación | Acción propuesta |
|---|---|---|---|
| `api/cuentas/telegram/route.ts` | +24 / **−354** | PROD tiene el webhook completo; LAB lo movió a `lib/cuentasTelegram.ts` | Consolidar en LAB: conservar `lib/cuentasTelegram.ts` + validar paridad funcional |
| `components/cuentas/Reports.tsx` | +22 / **−102** | PROD tiene más lógica en el componente | Revisar si LAB la movió a lib; si no, portar |
| `lib/api.ts` | 0 / **−44** | PROD lo tiene, LAB lo eliminó | Confirmar si es dead code; si LAB lo necesita, restaurar |
| `api/cuentas/ocr/internal/route.ts` | 0 / **−37** | **PROD tiene OCR interno; LAB lo perdió** | 🔴 Portar a LAB |
| `proxy.ts` | +15 / **−49** | PROD tiene más middleware (seguridad) | Portar a LAB |
| `api/health/route.ts` | +4 / **−48** | PROD tiene diagnóstico DB más rico | Portar a LAB |
| `app/cuentas/page.tsx`, `api/auth/login`, `lib/auth.ts` | mixto | ajustes finos | Revisar caso a caso |
| `app/outgoing-speakers/page.tsx` | **+423** / 0 | LAB tiene módulo nuevo (Discursantes salientes) | **LAB adelante** → candidato a PROD |
| `lib/cuentasTelegram.ts` | **+538** / 0 | LAB tiene refactor del bot Telegram | **LAB adelante** → candidato a PROD |
| `lib/db.ts` | +73 / −30 | LAB: fix upsert compuesto, RETURNING, SyncStatus | **LAB adelante** → portar a PROD (crítico) |
| `lib/schema.sql` | +34 / −27 | LAB: esquema más nuevo | Portar a PROD |
| `app/group-reports/page.tsx`, `api/restore/route.ts` | +32 cada | LAB: fix persistencia + restore atómico | Portar a PROD |
| `services/auto-assign-service.js` | +27 / −51 | LAB: versión reescrita | Conciliar con PROD `d9bc196` (divergen) |
| `components/TerritoryMap.tsx` | +26 / −5 | LAB: fix iPad | Portar a PROD |
| `lib/s89Individual.ts` | +21 / −3 | LAB: ajuste hojas | Portar a PROD |

> **Nota:** muchas mejoras de PROD parecen "faltar" en LAB a nivel commit, pero fueron **re-implementadas** (mismo mensaje, hash distinto): `52124a6≈330009b`, `e910399≈358dd16`, `9a1246c≈ae63916`, `72a0a58≈ac9dd0d`. El diff de **contenido** de arriba (34 archivos) es la fuente de verdad, no el diff de commits.

---

## 🛠️ Plan de ejecución por fases

### Fase 0 — Preparación (sin cambios de código)
- [ ] Etiquetar los 5 heads: `git tag pre-sync/vercel-main 54a88bf`, `pre-sync/prod 52124a6`, `pre-sync/lab 24d3e90`.
- [ ] Backup de SQLite PROD y LAB antes de tocar deploys (`/opt/msp/backup.sh`).
- [ ] Congelar deploys (desactivar cron auto-deploy del LAB) durante la ventana.
- [ ] Crear rama de trabajo en Vercel: `sync/vps-improvements`.

### Fase 1 — Formalizar el adapter (habilita sync limpia)
- [ ] Crear `src/lib/data/index.ts` con `getDataClient()` que elija `sqlite` o `supabase` según `DB_DRIVER`.
- [ ] `crud.ts`: `sb()` → `getDataClient()`.
- [ ] Crear `src/lib/auth/getSessionContext()` que elija JWT o Supabase según `AUTH_DRIVER`.
- [ ] Mover `db.ts`/`sqlite.ts` a `src/lib/data/sqlite/` (sin cambiar lógica).
- [ ] Build de Vercel con `DB_DRIVER=supabase` y build VPS con `DB_DRIVER=sqlite` deben pasar.
- [ ] **Criterio de salida:** mismo `src/` compila para ambos runtimes.

### Fase 2 — Portar features P1/P2/P3 (no rompientes)
- [ ] `programs.ts` (`e910399`).
- [ ] Suite de print/reportes (`exportProgram`, `exportS89`, `s89Individual`, `printReport`, `PrintModal`).
- [ ] Territorios iPad + capa táctil.
- [ ] `explaining_beliefs`, responsabilidades.
- [ ] Mensajería/Telegram (con adapter de datos).
- [ ] Verificación: `next build` + smoke test en Preview de Vercel.

### Fase 3 — Portar hardening P0 (requiere QA dedicado)
- [ ] Auth guard en rutas (equivalente Supabase: validar `getSessionContext()` y devolver 401).
- [ ] Rate-limit de login (p. ej. Upstash o en-memoria por instancia; documentar limitación serverless).
- [ ] Scoping estricto por `congregation_id` en `/api/users` y auto-assign.
- [ ] `zod v4` + middleware edge.
- [ ] Pruebas: usuario de congre A no ve datos de congre B; ruta sin sesión → 401.

### Fase 4 — Reconciliar PROD → LAB (`micongre.duckdns.org`)
- [ ] Portar OCR interno, `proxy.ts`, `health` diagnóstico a LAB.
- [ ] Consolidar Telegram (`lib/cuentasTelegram.ts` de LAB vs `route.ts` de PROD).
- [ ] Confirmar `lib/api.ts` (dead code) y decidir conservarlo/eliminarlo.
- [ ] Merge de `db.ts`/`schema.sql` de LAB (fix upsert compuesto) hacia PROD si PROD no lo tiene.
- [ ] Candidatos LAB→PROD: `outgoing-speakers`, `cuentasTelegram` refactor, db fixes.

### Fase 5 — Verificación end-to-end y cierre
- [ ] Smoke tests en las 3 URLs: login, home, mis-asignaciones, territorios, reportes, print.
- [ ] Confirmar `/api/health` = `{"ok":true}` en las 3.
- [ ] Documentar HEAD resultante de cada entorno.

---

## ✅ Acceptance Criteria

- [ ] **AC-1:** Vercel ya no sirve ningún endpoint de datos sin sesión válida (401 en ruta protegida sin cookie).
- [ ] **AC-2:** Un usuario de la congregación A no puede leer/escribir datos de la congregación B vía `/api/users` ni auto-assign.
- [ ] **AC-3:** `src/lib/programs.ts` de Vercel incluye Sep-2026 con las 4 partes de estudiante.
- [ ] **AC-4:** Print/reportes Vercel producen PDF/DOCX/XLSX con el mismo layout que VPS (paridad verificada lado a lado).
- [ ] **AC-5:** Territorios no se rompen en iPad/WebKit en Vercel.
- [ ] **AC-6:** `micongre.duckdns.org` recupera OCR interno, diagnóstico health y middleware de seguridad.
- [ ] **AC-7:** Ningún archivo VPS-only (`db.ts`, `sqlite.ts`, `deploy/`, `infra/`) fue arrastrado al build de Vercel.
- [ ] **AC-8:** El mismo `src/` compila para ambos drivers (`DB_DRIVER=supabase|sqlite`).
- [ ] **AC-9:** Rollback probado (revert de la rama de sync → Vercel `main` restaurado en < 10 min).
- [ ] **AC-10:** Documentación de topología y HEADs actualizada.

---

## 📊 Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Diferencias de esquema Supabase vs SQLite (tipos, JSON, PK) | Alta | Alto | Adapter + pruebas por módulo; no copiar `schema.sql` a Vercel |
| Auth distinto (Supabase vs JWT) rompe sesiones | Media | Alto | `AUTH_DRIVER` + validación en preview antes de prod |
| `better-sqlite3`/fs no corren en Vercel serverless | Alta | Alto | VPS-only por build-time exclusion / feature flags |
| Features re-implementadas divergentes (auto-assign, Telegram) | Alta | Medio | Elegir una versión canónica y test de paridad funcional |
| Deriva de datos PROD vs LAB | Media | Alto | Backups + no tocar data; solo código |
| Cherry-pick arrastra infra sin querer | Media | Medio | Checklist de archivos prohibidos por PR |

**Rollback:** Vercel conserva `main`; el sync vive en `sync/vps-improvements`. Un `git revert` del merge o redeploy del commit `54a88bf` restaura Vercel. VPS: re-desplegar el tag `pre-sync/*` correspondiente.

---

## 🔗 Artefactos

- `PROPUESTA-FUSION-MICONGREFINANVPS.md`
- `ANALISIS-TOPOLOGIA-4-REPOS.md`
- `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md`
- `RESUMEN_PROYECTO_MSP_COMPLETO.md`

---

*Este wargame no modifica producción por sí mismo: describe la maniobra. La ejecución debe hacerse fase por fase con verificación entre cada una. No cerrar hasta que los 10 AC pasen en las tres URLs.*
