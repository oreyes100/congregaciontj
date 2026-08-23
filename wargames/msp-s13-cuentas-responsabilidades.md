# War-game: S-13 exact format · Cuentas dark mode · Responsabilidades organigrama
> Executor: run moves in order. Before each move, read failure signals. Check abort conditions after every move.

## Mission objective
1. Territory S-13 export (PDF/XLSX/DOCX) must match the official S-13-S template exactly: 14 columns, name in own column (not merged with date), colspan-3 "Asignado a" header, exact footer text.
2. Cuentas dark mode must apply to the full wrapper UI, not just sidebar (iframe content is external — uncontrollable, acceptable).
3. Responsibilities page must show all roles from ORGANIGRAMA REVISADO.docx organized in categories, with a professional PDF/XLSX export.
4. Territories toolbar must not overflow — fix layout.

## Recon summary

### S-13 columns (from filled PDF example)
Total 14 cols:
- Col 1: "Núm. de terr." (rowspan 2)
- Col 2: "Última fecha en que se completó*" (rowspan 2)
- Cols 3-5: "Asignado a" (colspan 3) → sub: [Nombre] | [Fecha asignó] | [Fecha completó]
- Cols 6-8: same
- Cols 9-11: same
- Cols 12-14: same

Each territory data row: num | last_completed | name1 | date_assigned1 | date_completed1 | name2 | ... | name4 | date4 | completed4

### Cuentas dark mode bug
- `cuentas/page.tsx` uses inline `isDark ? 'bg-gray-900'` ternary
- `mode === 'system'` makes `isDark = false` even in system-dark
- Fix: use Tailwind `dark:` classes (ThemeProvider already sets `document.documentElement.class dark`)

### Organigrama roles (from docx, JW congregation structure)
**Cuerpo de Ancianos (main 5):**
- Coordinador del cuerpo de ancianos → `elders_coordinator` (exists)
- Conductor del Estudio de la Atalaya → `watchtower_conductor` (exists)
- Secretario → `secretary` (exists)
- Superintendente de Servicio → `service_overseer` (exists)
- Coordinador VMC (Vida y Ministerio Cristiano) → `life_ministry_coordinator` (new)

**Bajo Secretario:** Envío de Informes, Analizar Precursores, Lectores, Tarjetas Publicador (S-21), Archivo Congregación (S-61), Envío Correspondencia

**Bajo VMC:** Tablero, Sala Auxiliar

**Bajo Superintendente de Servicio:** Analizar Precursores, Escuela Lectura y Escritura, Visita Grupos, Organizar Visita SC, Capacitación P.P

**Bajo Coordinador:** Limpieza, Presidente, Audio y Video, Plataforma, Acomodadores, Intervención Cuentas, Siervo Publicaciones, Contabilidad, Biblioteca, Sala Auxiliar, Visita Grupos

### congregation_roles API
- PUT currently does UPDATE (not upsert) → new role_keys silently fail
- Composite PK: (role_key, congregation_id) → need raw SQLite INSERT OR REPLACE
- GET: must seed/return ALL catalog roles even if not yet in DB

### Current code locations
- `src/app/api/congregation-roles/route.ts` — GET/PUT
- `src/app/responsibilities/page.tsx` — UI (only 6 roles currently)
- `src/app/territories/page.tsx` — S-13 export, toolbar
- `src/app/cuentas/page.tsx` — dark mode bug

## Moves

### Move 1: Fix congregation-roles API (upsert + full catalog)
- **Action:** Rewrite `congregation-roles/route.ts`. Define ROLES catalog (all 28 role_keys). GET: fetch DB rows, merge with catalog defaults (missing = null persons). PUT: raw `INSERT OR REPLACE` (handles composite PK).
- **Expected:** GET returns all 28 roles; assigning a new role_key persists correctly.
- **Failure signal:** 500 on PUT for a new role_key.
- **Countermove:** Check `congregation_id` is being included in the INSERT OR REPLACE.

### Move 2: Expand responsibilities/page.tsx
- **Action:** Replace current 6-role layout with full 28-role layout, organized in 6 color-coded sections. Add "Exportar Reporte" button → professional PDF via jsPDF. Fix dark mode (Tailwind dark: classes throughout, drop manual isDark).
- **Expected:** Page shows all roles in sections, dark mode applies without toggling.
- **Failure signal:** Missing roles or blank sections on load.
- **Countermove:** Check ROLES catalog keys match GET response `role_key` field.

### Move 3: Fix S-13 PDF/XLSX/DOCX format (territories)
- **Action:** Rewrite export functions. 14 cols: [num, última, name1, assigned1, completed1, name2, ...]x4. Fix jspdf header (colspan 3 per slot). Fix XLSX (separate columns). Fix DOCX (14-col table). Move export button below list to fix overflow.
- **Expected:** Downloaded file matches S-13-S template layout exactly.
- **Failure signal:** Dates appear in name column or columns misaligned.
- **Countermove:** Check `slots` array indexing — each slot produces 3 values not 2.

### Move 4: Fix cuentas dark mode
- **Action:** Rewrite `cuentas/page.tsx` to use Tailwind `dark:` classes instead of `isDark` ternary. Remove `isDark` variable entirely.
- **Expected:** Header/wrapper changes color when dark mode is active.
- **Failure signal:** Page looks identical in dark mode.
- **Countermove:** Check ThemeProvider is applying `dark` class to `<html>` — verify in browser.

### Move 5: Build + deploy to VPS
- **Action:** `npm run build`. rsync to VPS. pm2 reload.
- **Expected:** Build succeeds, zero TS errors. VPS health check passes.
- **Failure signal:** TS errors in responsibilities page (PersonPickerModal props, role types).
- **Countermove:** Check PersonPickerModal accepts the correct `persons` type.

## Unresolved assumptions
- Exact visual grouping of roles to sections: assumed from JW org structure, not explicit in docx (flat list only).
- Sub-responsibility roles (e.g. "Analizar Precursores" appears under both Secretario and Service Overseer): will create one role_key, shown in appropriate section.

## Abort conditions
- Build fails with TS error that cannot be resolved without major refactor → skip that section.
- congregation_roles INSERT OR REPLACE fails because congregation_id is null → add null-coalesce guard.
