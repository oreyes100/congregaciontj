# BASE DE CONOCIMIENTO — MSP: Infraestructura, Acceso y Despliegue

_Fecha de revisión: 2026-08-23 · Fuente: sesión de diagnóstico y despliegue en producción_

---

## 1. TOPOLOGÍA REAL DE RED

```
Internet (WAN 207.248.113.8)
   │
   ▼
pfSense "capuvps.duckdns.org" (VM en QEMU dentro de pve)
   │  SSH externo: puerto 2223 (usuario admin / Michoacan1) → opción 8 = shell
   │  Interfaces: WAN vtnet1 · LAN 192.168.1.1 · VPS(vlan6) 192.168.6.1
   │
   ├──► BASTIÓN / NODO PROXMOX "pve" = 192.168.1.4  (root / uljTQZj_MKCuayAQ)
   │      • Router/NAT de la red interna
   │      • socat: 3002→1.3:3002 · 8008→1.254:8006 · 8007→1.96:8006
   │      • NAT DNAT: 443+8091→6.152:443 (web pública CAÍDA) · 8211→6.136:80
   │                   22211→6.136:22 · 22212→6.196:22 · 22213→6.148:22
   │      • VMs: 100 ubuntu · 101 win11 · 102 hermesagent · 103 openclawserver
   │              104 aulamedios · 202 vps-demo · 210 vps-panel(=.34) ·
   │              211 MICONGRE/VPS-app · 212 videoobsidian · 213 vpbrain ·
   │              250 vps-demo-n2 · 500 pfsense2 · 9000 template · LXC 200 panel
   │
   └──► VLAN 6 (192.168.6.0/24) — SOLO accesible desde pfSense o el host pve
          • 192.168.6.136 = VM 211 "micongre" → ★ MSP PRODUCCIÓN ★
          • 192.168.6.152 = web pública :443 (CAÍDA)
          • 192.168.6.191 = VM misfinz ("Mis finazas", proyecto distinto)
```

### Regla de oro de conectividad
> La VLAN 6 **solo se alcanza desde pfSense o desde el host pve**. Desde una VM de
> la LAN (.34, .250) o desde Internet directo está bloqueado. Para operar sobre
> producción se puentea: `Mac/PC → pfSense(:2223) → pve → devops@192.168.6.136`.

---

## 2. CREDENCIALES Y ACCESOS

| Destino | Usuario | Password | Notas |
|---|---|---|---|
| pfSense (WAN :2223) | `admin` | `Michoacan1` | Menú → opción 8 = shell |
| Proxmox pve (192.168.1.4) | `root` | `uljTQZj_MKCuayAQ` | Desde pfSense o bastión |
| VM 211 producción | `devops` | `uljTQZj_MKCuayAQ` | Desde pve (VLAN6) |
| VM 250 lab (vps-demo-n2) | `devops` | `5W_J8ss4MmkKn%sf` | Idem |
| Panel VPS (.34) | `admin` | `Michoacan1` | sudo OK |
| Token Proxmox del panel | `panel@pve!panel` | secret en `/opt/vps-panel/backend/config/nodes.json` | privsep=0 ≈ root por API |

⚠️ **Rotar estas contraseñas**: quedaron expuestas en documentos/chat. Diferenciar
la clave del panel de la de root@pve.

### Comandos de conexión probados

```bash
# A) Salto doble desde macOS/Linux hacia producción (VLAN6):
sshpass -p 'uljTQZj_MKCuayAQ' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 \
  -o ProxyCommand="sshpass -p 'Michoacan1' ssh -p 2223 -o StrictHostKeyChecking=no -W %h:%p admin@207.248.113.8" \
  devops@192.168.6.136 "<comando>"

# B) SCP por el mismo puente (el sshpass EXTERNO autentica al destino final;
#    el ProxyCommand lleva su propio sshpass para pfSense):
sshpass -p 'uljTQZj_MKCuayAQ' scp -o StrictHostKeyChecking=no \
  -o "ProxyCommand=sshpass -p Michoacan1 ssh -p 2223 -o StrictHostKeyChecking=no -W %h:%p admin@207.248.113.8" \
  archivo_local devops@192.168.6.136:/tmp/

# C) pfSense NO tiene sshpass. Para SSH con password desde su shell usar SSH_ASKPASS:
cat > /tmp/ap.sh <<'EOF'
#!/bin/sh
echo 'LA_PASSWORD'
EOF
chmod +x /tmp/ap.sh
DISPLAY=:0 SSH_ASKPASS=/tmp/ap.sh SSH_ASKPASS_REQUIRE=force ssh devops@192.168.6.136 'cmd'
```

---

## 3. MSP PRODUCCIÓN (VM 211 "micongre")

| Item | Valor |
|---|---|
| IP interna | 192.168.6.136 (VLAN 6) |
| Exposición pública | NAT `8211 → 6.136:80`; dominio `https://congregaciontj.duckdns.org` |
| SSH externo | NAT `22211 → 6.136:22` (`ssh -p 22211 devops@207.248.113.8`) |
| App | Next.js standalone bajo PM2, proceso `meeting-scheduler-pro` en `:3000`; nginx local `:80 → 3000` |
| Directorio | `/opt/msp` |
| Repo canónico | **`github.com/oreyes100/meeting-scheduler-pro`** rama **`vps-selfhosted`** (⚠️ NO confundir con `meeting-scheduler-pro-vps` ni `congregaciontj`) |
| Despliegue | `/opt/deploy-msp.sh`: clon fresco → preservar fixes locales → `npm ci` → `build` → swap de artefactos (server.js standalone, `.next` sin cache, static, public, pdf-templates) → PM2 delete+start |
| BD | SQLite `/opt/msp/data/msp.db` — con datos reales: `cuentas_transactions` 76 · `cuentas_codes` 14 · `cuentas_telegram_pending` 3 · `cuentas_config` 1 · `cuentas_saldo_inicial` 1 |
| Env crítico (`ecosystem.config.cjs`) | `CUENTAS_INTERNAL_URL=https://cuentas-congregacion-bay.vercel.app` · `CUENTAS_MASTER_SECRET=e9da04…1303` · AUTH_SECRET · SUPER_ADMIN_EMAILS |

### Las DOS versiones de Cuentas
| Versión | Ubicación | Acceso en UI |
|---|---|---|
| **Cuentas (iframe)** | Vercel: `cuentas-congregacion-bay.vercel.app` — código en `oreyes100/misfinanzsvps/Cuentas/` | Menú → **"Cuentas"** (`/cuentas`) |
| **Cuentas integrada** | Nativa en este repo: `src/app/cuentas-v2/page.tsx` (62 KB UI) + `src/app/api/cuentas/*` (transactions, codes, config, saldo-inicial, cierre-mes, reports, import, ocr, telegram) | Menú → **"Cuentas v2 ⚗️"** (`/cuentas-v2`, `adminOnly`) |

El menú vive en el array `MODULES` de `src/lib/modules.ts` y lo renderiza
`IconSidebar.tsx` con `canAccess(me, m.key, m.adminOnly, m.superAdminOnly)`.

---

## 4. INCIDENTE RESUELTO (2026-08-23): menú sin Cuentas + web sin respuesta

**Dos problemas encadenados:**

1. **Faltaba regla `FORWARD` en el bastión pve** para `6.136:80`. El DNAT `8211`
   existía, pero los paquetes morían en el nodo. → Regla agregada y persistida en
   `/etc/iptables/rules.v4`.
2. **`/opt/msp` era un clon del repo EQUIVOCADO** (`congregaciontj@main`, sin el
   módulo Cuentas); un build in-place de las 03:00 pisó el deploy bueno con código
   viejo (modules.ts del 26-jul, `.next` sin `api/cuentas`). → Repo interno
   re-apuntado a `meeting-scheduler-pro@vps-selfhosted` (682ef28), build in-place +
   swap + PM2.

**Verificación end-to-end** (puerto público :8211): health `{"ok":true}` · menú
compilado contiene "Cuentas" y "Cuentas v2 ⚗️" · `api/cuentas/*` presentes (401 sin
sesión = correcto) · `/cuentas-v2` responde.

**Blindaje**: con `/opt/msp` apuntando al repo correcto, el flujo habitual
(`git pull && npm run build && pm2 restart`) ya produce el build completo. Se
preservaron `ecosystem.config.cjs`, `.env` y el fix de auto-asignación.

---

## 5. ENTORNO LAB SEPARADO (no confundir)

| Item | Valor |
|---|---|
| Host | VM 250 `vps-demo-n2` — 192.168.1.250 (LAN, NO vlan6) |
| App | `/opt/msp` clon de `oreyes100/meeting-scheduler-pro-vps` @ `vps-selfhosted`, PM2 en puerto **3010** |
| URL pública | `https://micongre.duckdns.org` (nginx vhost en vps-panel .34 → proxy 3010, certbot LE) |
| Auto-deploy | cron `*/15 * * * * /opt/deploy_update.sh >> ~/deploy_update.log` (pull+build+reload) |
| Deploy key | `~/.ssh/msp_deploy_ed25519` (GitHub id 161079389, read-only sobre meeting-scheduler-pro-vps) |
| Puerto 3000 | OCUPADO por `~/mis-finanzas/server` — no liberar |

⚠️ Los fixes de restore/backup y agente Telegram hechos hoy viven en el repo
`meeting-scheduler-pro-vps`. Verificar si `meeting-scheduler-pro` (producción) ya los
incluye o hace falta portarlos.

---

## 6. PENDIENTES ABIERTOS

1. **"Producción no responde" intermitente**: app local sana (:3000 health OK, :80
   local 200 vía proceso pid≠docker). El contenedor docker `app-web-1` (nginx)
   desapareció. Confirmar por dónde accede el usuario final (¿NAT 8211?, ¿443→6.152
   caído?) y estabilizar el proxy del :80 (restaurar docker nginx o NAT directo).
2. **Subir a GitHub el fix de `auto-assign-service.js`** — solo existe en el VPS;
   cualquier `deploy-msp.sh` futuro lo perdería si no se re-copia antes del build.
3. Portar a `meeting-scheduler-pro` los fixes del lab si aplica (restore atómico FK,
   secciones de backup con Cuentas, agente Telegram) — verificar diff entre repos.
4. Rotar credenciales expuestas y diferenciar password del panel vs root@pve.
5. Revisar caída de 192.168.6.152 (web pública 443).

## 7. LECCIONES APRENDIDAS (operación)

- `pfSense` no tiene `sshpass`; usar `SSH_ASKPASS_REQUIRE=force` o instalar llave.
- El `sshpass` **externo** autentica al destino final; cada salto del ProxyCommand
  necesita su propio sshpass embebido en el ProxyCommand.
- VLAN6 inalcanzable desde LAN: todo puentea por pfSense o pve (API con token
  `panel@pve!panel` permite termproxy/consola serie aunque el agente QEMU falle).
- Nunca asumir qué repo está desplegado en `/opt/msp`: verificar `git remote -v` +
  `git log` ANTES de cualquier build in-place (causa raíz del incidente del 23-ago).
- Los builds in-place sobre un checkout equivocado destruyen deploys: preferir
  clon fresco + swap de artefactos (patrón `deploy-msp.sh`).

---
*Documento generado desde la sesión real de diagnóstico — mantener actualizado.*

---

## 8. SINCRONIZACIÓN 2026-08-23 (noche) — Export de Cuentas + GitHub al día

| Acción | Resultado |
|---|---|
| Commits `61663b0` + `aac69d8` (export CSV, sección Cuentas en /backup, etiqueta v2, filenames) rescatados del VPS vía `git bundle` | ✅ **Push a `meeting-scheduler-pro@vps-selfhosted`** (`682ef28..aac69d8`) — ya no se pierden con deploy-msp.sh |
| Port de esos cambios + fixes FK/restore atómico al LAB (`meeting-scheduler-pro-vps`) | ✅ Commit **`fe03076`** pushado; lab `.250` realineado (`reset --hard`, build EXIT=0, reload PM2) |
| Verificación funcional en lab (micongre.duckdns.org) | `/api/cuentas/transactions?format=csv` → CSV completo (filename `cuentas-transacciones-<fecha>.csv`, 80 filas reales incl. aprobadas por Telegram) · `/api/backup?sections=cuentas&format=csv` → **ZIP multisección** · label "Cuentas v2 (Contabilidad)" compilado |

### Riesgos/pendientes heredados de la sesión de producción
1. 🔴 **Seguridad**: el export CSV de `cuentas_config` incluye `ai_api_key` en plano → rotar la key si sale del entorno; considerar enmascarar en exports futuros.
2. 🟡 Cron del VPS de producción referencia `backup.sh` y `healthcheck.py` que **no existen** (errores diarios) → recrear o quitar entradas.
3. 🟡 Fix `auto-assign-service.js`: confirmar si ya está en GitHub `meeting-scheduler-pro` (commit `1d9af13` existe en congregaciontj; verificar en meeting-scheduler-pro).

> Nota de naming: `micongre.duckdns.org` apunta al LAB (.250:3010); el despliegue
> por panel de la VM 211 usa `micongre.capuvps.duckdns.org`. Producción principal
> sigue siendo `congregaciontj.duckdns.org`.

---

## 9. CIERRE 2026-08-23 — auto-assign blindado + cron reparado

| Acción | Resultado |
|---|---|
| Fix `auto-assign-service.js` (54+/157−) commiteado EN EL VPS como `d9bc196` | ✅ fin del "cambio local sin commit" |
| Bundle `origin/vps-selfhosted..HEAD` → push a GitHub vía Mac | ✅ `aac69d8..d9bc196` en meeting-scheduler-pro@vps-selfhosted |
| `/opt/msp/backup.sh` creado (better-sqlite3 .backup() diario 3am + prune 14 días) | ✅ probado: `backups/msp-2026-08-23.db` (1 MB) |
| `/opt/msp/healthcheck.py` creado (urllib health :3000, exit≠0 si falla; cron cada 15 min) | ✅ probado: OK |
| Estado crontab producción | ✅ 3 entradas todas funcionales (backup 3am · healthcheck 15min · notificaciones territorio 9am) |

**Pendiente vigente único**: rotar/enmascarar `ai_api_key` que sale en exports CSV de `cuentas_config`.
