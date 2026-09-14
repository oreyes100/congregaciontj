# RESUMEN COMPLETO DE SESIÓN — PROYECTO MSP (Meeting Scheduler Pro) + Cuentas v2

_Compilación íntegra del chat del proyecto · 2026-08-23 (sesión 6) · formato consolidado "MP"_

---

## 0. ÍNDICE RÁPIDO

1. [Infraestructura y accesos](#1-infraestructura-y-accesos)
2. [Repositorios (3 linajes)](#2-repositorios-3-linajes)
3. [Cronología de la sesión](#3-cronología-de-la-sesión)
4. [Trabajos realizados (detalle)](#4-trabajos-realizados-detalle)
5. [Estado final por entorno](#5-estado-final-por-entorno)
6. [Pendientes](#6-pendientes)
7. [Lecciones / convenciones](#7-lecciones--convenciones)
8. [Archivos y scripts generados](#8-archivos-y-scripts-generados)

---

## 1. INFRAESTRUCTURA Y ACCESOS

### Red y máquinas
- **pfSense** `capuvps.duckdns.org:2223` (admin / `Michoacan1`) — bastión/router principal que da salto a la LAN interna.
- **Proxmox `pve`** `192.168.1.4` (root / `uljTQZj_MKCuayAQ`) — nodo + NAT (iptables), VLAN6.
- **VM 211 "micongre"** `192.168.6.136` — **PRODUCCIÓN MSP**. `/opt/msp`: PM2 `meeting-scheduler-pro` :3000, docker `app-web-1` (nginx :80→3000) + `app-db-1` (mysql :3306). BD real: SQLite `/opt/msp/data/msp.db`.
- **VM 250 "vps-demo-n2"** `192.168.1.250` — **LAB**. PM2 :3010. URL pública `https://micongre.duckdns.org`.
- **Panel VPS ".34"** (VM 210, nginx) → proxy por hostname: `congregaciontj.duckdns.org` y `micongre.duckdns.org`.
- **VM 152** `192.168.6.152` — nginx Panel Proxmox en 443 (entrada del dominio duckdns hacia MSP por hostname).
- **VM 191 "misfinz"** `192.168.6.191` — proyecto DISTINTO (Mis Finanzas / dineroorganizado.duckdns.org).

### Accesos (desde Mac)
- Producción: `sshpass -p 'uljTQZj_MKCuayAQ' ssh -p 22211 -o StrictHostKeyChecking=no devops@207.248.113.8` (NAT `22211→6.136:22`).
- Lab: doble salto `sshpass -p Michoacan1 ssh -p 2223 … admin@207.248.113.8` como ProxyCommand → `devops@192.168.1.250` (`5W_J8ss4MmkKn%sf`).
- pfSense NO tiene sshpass → usa `SSH_ASKPASS_REQUIRE=force` con script `echo`.
- ⚠️ **Rotar todas las credenciales expuestas** (pfSense admin, pve root, devops VM211/VM250).

### Puertos / NAT (pve)
- `443` y `8091 → 6.152:443` · `22211 → 6.136:22` · `8211 → 6.136:80` · `2202 → 6.152:22` · `22212 → 6.196:22` · `8212 → 6.196:80` · `22213 → 6.148:22` · `2203/8446 → 6.191`.
- FORWARD: se agregó y persistió `ACCEPT -d 192.168.6.136 --dport 80` (regla que faltaba y dejaba "producción no responde").
- WAN pública: `207.248.113.8`. Dominio producción: `congregaciontj.duckdns.org`. Lab web: `micongre.duckdns.org`.

---

## 2. REPOSITORIOS (3 LINAJES)

| Repo | Rama | HEAD (al cierre) | Rol |
|---|---|---|---|
| `oreyes100/meeting-scheduler-pro` | `vps-selfhosted` | **`d9bc196`** | Runtime de PRODUCCIÓN (VM211). Canónico y ≡ VPS |
| `oreyes100/meeting-scheduler-pro-vps` | `vps-selfhosted` | **`fe03076`** | Runtime de LAB (VM250) + experimentos (Telegram, restore FK) |
| `congregaciontj` (local) | `main` | **`18d237c`** | Legacy UI + docs/KB (`PROCEDIMIENTO_*.md`) + workflow deploy inerte |

**Método de push sin credenciales en el VPS** → `git bundle` (VPS) → scp doble a Mac/Windows → `git fetch` del bundle en clon local → `git push origin` usando Git Credential Manager. (No hay `gh` CLI.)

---

## 3. CRONOLOGÍA DE LA SESIÓN

1. **Auditoría de blueprints/SDD del vault** → stack del proyecto validado (Session Efficiency + Persistent Context + Plan First + SDD). NO se adopta infra RTK/MCP. Higiene de memoria (referencias fantasma, puerto boot 3000, Contexto Activo compactado).
2. **Implementación del Agente de Recibos Telegram** en `meeting-scheduler-pro-vps`: webhook `/api/cuentas/telegram` + OCR Gemini + tabla `cuentas_telegram_pending` + botones ✅/❌. Commits `61ef8c7`, `49722a5`, `395f5c5`. Push OK.
3. **Merge conflict** `territories/page.tsx` resuelto (blend móvil + features), `tsc` limpio.
4. **Infra de despliegue**: `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` + `.github/workflows/deploy.yml` subidos al repo `congregaciontj`. Cron auto-deploy 15 min en lab (`/opt/deploy_update.sh`). Deploy key read-only nueva (`msp_deploy_ed25519`).
5. **Exposición del lab**: port-forward pfSense WAN:3010→250:3010 + ufw → `http://congregaciontj.duckdns.org:3010/api/health` = `{"ok":true}`.
6. **Limpieza disco lab**: 159 MB → 3.3 GB libres.
7. **micongre.duckdns.org en HTTPS**: vhost nginx nuevo en vps-panel (.34) proxy→250:3010 + certbot LE + redirect 301.
8. **Login/super-admin lab arreglado**: usuario `admin` creado + `AUTH_SECRET` persistente → /api/auth/session y /super-admin 200.
9. **Backup restore corregido**: era no-atómico y sin FK off (fallaba y destruía users). Ahora: FK off + orden canónico `ALL_TABLES` + stubs `congregations` + `foreign_key_check`. Roundtrip verificado.
10. **Backups incluyen Cuentas**: `BACKUP_SECTIONS` con sección `cuentas` (4 tablas) + `messaging` + `congregation` + `territory_assignments` + `public_talk_history`. Label "Cuentas v2 (Contabilidad)".
11. **Export CSV de transacciones**: `?format=csv` (límite 200k) + botón verde en /cuentas-v2 + filenames por sección. Portado desde producción.
12. **(Paralelo Windows) Descubrimiento de producción real**: VM211 tenía repo equivocado (`congregaciontj@main` viejo sin cuentas-v2) → re-apuntado a `meeting-scheduler-pro@vps-selfhosted`; FORWARD 6.136:80 agregado/persistido; menú Cuentas + Cuentas v2 ⚗️ operativo en `congregaciontj.duckdns.org`.
13. **GitHub 100% sincronizado**: `meeting-scheduler-pro` = `d9bc196` (incluye fix auto-assign −157 líneas que solo vivía en VPS, vía bundle); `meeting-scheduler-pro-vps` = `fe03076`.
14. **Cron de producción reparado**: `backup.sh` (SQLite diario 3am + prune 14d) y `healthcheck.py` creados/probados → fin de errores diarios en `backup.log`.
15. **Cierre de KB/memoria** (`18d237c`) + sesión 6 registrada en `sessions.jsonl` (score 9).

---

## 4. TRABAJOS REALIZADOS (DETALLE)

### 4.1 Agente Telegram de Recibos (lab)
- Webhook `POST /api/cuentas/telegram` con `x-telegram-secret`.
- `processTelegramUpdate()`: descarga foto → OCR Gemini (`GOOGLE_API_KEY`/`GEMINI_API_KEY`) → parse monto/emisor/concepto → inserta en `cuentas_telegram_pending` con `UNIQUE(chat_id,message_id)` (idempotente) → genera teclado inline ✅/❌.
- Acción ✅ → `INSERT` en `cuentas_transactions` con `source='telegram'`, marca fila pending `applied=1`.
- **En producción (lab) ya asienta recibos reales** (CSV de transacciones muestra "Recibo aprobado en Telegram por @JorgeORR26").

### 4.2 Restore atómico + FK off
- Antes: restauración en orden arbitrario con FK activas → violación al insertar tablas dependientes → rollback que borraba `users`.
- Ahora: `PRAGMA foreign_keys=OFF` durante toda la operación, orden canónico `ALL_TABLES`, `INSERT OR REPLACE` + stubs de `congregations` para dumps legacy, y `foreign_key_check` reportado en la respuesta.
- `db.ts`: helpers `setForeignKeys()` + `foreignKeyCheck()`.

### 4.3 Backups con Cuentas
- `/backup?sections=cuentas&format=csv` → **ZIP** con un CSV por tabla (`cuentas_config`, `cuentas_saldo_inicial`, `cuentas_codes`, `cuentas_transactions`).
- JSON dump completo; Restaurar acepta las 4 tablas juntas.
- `/cuentas-v2?format=csv` → todas las transacciones (filename `cuentas-transacciones-<fecha>.csv`).

### 4.4 Login / super-admin (lab)
- Creado usuario `admin` (`bcrypt`); persistido `AUTH_SECRET` en `ecosystem.config.cjs` → `/api/auth/session` y `/super-admin` responden 200.

### 4.5 Exposición HTTPS (micongre.duckdns.org)
- vhost nginx en vps-panel (.34) → proxy_pass `192.168.1.250:3010`; certbot LE con redirect 301 + renovación.

### 4.6 Sincronización GitHub
- VPS commits `61663b0` + `aac69d8` (export CSV + sección Cuentas + filenames) rescatados vía bundle → push a `meeting-scheduler-pro@vps-selfhosted`.
- Fix auto-assign `d9bc196` commiteado en VPS (54+/157−) → bundle → push.
- Lab: `fe03076` (port export + restore FK + db.ts helpers) pushado y clon `.250` realineado (`reset --hard`, build EXIT=0).

### 4.7 Cron producción
- `0 3 * * * /opt/msp/backup.sh` → `node better-sqlite3 .backup()` a `backups/msp-<fecha>.db` + prune 14 días. Probado: 1 MB generado.
- `*/15 * * * * /opt/msp/healthcheck.py` → `urllib` a `/api/health`, exit≠0 si falla. Probado: OK.
- `0 9 * * * curl -X POST -H 'x-cron-secret:…' /api/territory-notifications/run` (ya funcionaba).

---

## 5. ESTADO FINAL POR ENTORNO

| Componente | Estado |
|---|---|
| MSP producción (PM2 :3000 / nginx :80) | ✅ Online, health OK |
| Menú Cuentas + Cuentas v2 ⚗️ | ✅ Visibles (v2 requiere admin) |
| FORWARD 8211→6.136:80 | ✅ Regla activa + persistida |
| Repo interno /opt/msp | ✅ Correcto, ≡ GitHub `d9bc196` |
| Backup sección Cuentas (JSON+ZIP) | ✅ En producción |
| Botón Exportar CSV /cuentas-v2 | ✅ Operativo |
| Lab micongre.duckdns.org HTTPS | ✅ Proxy + LE, login OK |
| Agente Telegram (lab) | ✅ Asienta recibos reales |
| Cron producción | ✅ 3 entradas funcionales |
| GitHub ambos repos | ✅ Sincronizados (d9bc196 / fe03076) |
| KB / memoria | ✅ Actualizadas (18d237c, sesión 6) |

---

## 6. PENDIENTES

1. 🔴 **Rotar/enmascarar `ai_api_key`** que sale en exports CSV de `cuentas_config`.
2. 🟡 **Paridad de fixes entre repos hermanos**: confirmar si restore FK / db.ts helpers ya están en `meeting-scheduler-pro` (están en `meeting-scheduler-pro-vps`).
3. 🟡 `programs.ts` cubre hasta Aug 17 2026; faltan semanas Aug 18+.
4. 🟢 Probar agente Telegram end-to-end en PRODUCCIÓN (script `setup-telegram-agent.sh`).
5. 🟢 Workflow `deploy.yml` en repo `congregaciontj` es inerte (rama `vps-selfhosted` inexistente aquí).
6. 🔴 **Rotar credenciales** de pfSense/pve/VMs expuestas en este documento.

---

## 7. LECCIONES / CONVENCIONES

- Verificar SIEMPRE `git remote -v` del checkout in-place antes de compilar (dos repos peleaban por `/opt/msp`).
- Rebuilds deben re-aplicar fixes locales no pusheados ANTES de compilar.
- Cadena de validación: DNS → router ISP → DNAT bastión → FORWARD → :80 → :3000 → auth → chunk.
- Push desde VPS sin credenciales → patrón **bundle + GCM** (reutilizable).
- Restore: idempotente por PK (merge) o replace total con confirmación; `UNIQUE(chat_id,message_id)` protege webhook Telegram de duplicados.

---

## 8. ARCHIVOS Y SCRIPTS GENERADOS

- `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` (repo congregaciontj) — topología real, accesos, dos versiones Cuentas, incidentes, cierres 8 y 9.
- `.github/workflows/deploy.yml` (inerte en congregaciontj).
- Lab: `/opt/deploy_update.sh` (cron auto-deploy 15 min), `/opt/msp/backup.sh`, `/opt/msp/healthcheck.py` (producción).
- Patches: `backupSections.ts`, `api/backup/route.ts`, `api/cuentas/transactions/route.ts`, `cuentas/ImportPanel.tsx`, `api/restore/route.ts`, `lib/db.ts`.
- Backups VPS: `/tmp/msp-local-guard/`, `/tmp/msp-export-guard/`, `/opt/msp/data/msp.db.bak.*`.
- Este resumen: `RESUMEN_PROYECTO_MSP_COMPLETO.md`.

---
_Generado el 2026-08-23 como cierre de sesión 6. Archivo no commiteado (entrega de documentación)._
