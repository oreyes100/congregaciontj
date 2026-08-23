# Contexto Activo — Meeting Scheduler Pro / Sesión actual

## Estado del Proyecto
- **Versión**: 0.x (en desarrollo activo)
- **Sprint activo**: NINGUNO
- **Deploy PRODUCCIÓN**: VM 211 "micongre" = `192.168.6.136` (VLAN6, solo vía pfSense/pve) — `/opt/msp`, PM2 :3000, nginx :80, público `https://congregaciontj.duckdns.org` (NAT 8211→6.136:80). Repo canónico: **`oreyes100/meeting-scheduler-pro` @ vps-selfhosted**. BD SQLite con datos reales (76 tx cuentas).
- **Lab**: `vps-demo-n2` (192.168.1.250) puerto **3010**, auto-deploy cron, URL pública `https://micongre.duckdns.org` — repo distinto: `meeting-scheduler-pro-vps` (ver DJ 2026-08-23-b)
- **KB completa**: `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` (topología real, accesos, dos versiones de Cuentas, incidente menú sin Cuentas resuelto)
- **Git**: `main` sincronizada — commits del día: `10d85f6` (doc procedimiento VPS), `64b0c57` (workflow deploy)

## Última Sesión (2026-08-23, sesión 5)
### Completado
- **Análisis de blueprints/metodologías del vault** vs este proyecto → stack confirmado correcto (Session Efficiency + Persistent Context + Plan First + SDD); NO adoptar infra RTK/MCP. Higiene aplicada: referencias fantasma eliminadas (CLAUDE.md, MOC), puerto boot corregido a 3000, Contexto Activo compactado.
- **Agente de recibos Telegram implementado** en `meeting-scheduler-pro-vps` (rama vps-selfhosted): webhook `/api/cuentas/telegram` + OCR Gemini + tabla `cuentas_telegram_pending` + botones ✅/❌ (commits `61ef8c7` merge territories, `49722a5` feat agente, `395f5c5` memoria). Push a origin OK.
- **Merge conflict resuelto** `territories/page.tsx` (blend fixes móviles main + features vps-selfhosted; tsc limpio).
- **Infraestructura de despliegue**:
  - `PROCEDIMIENTO_CONEXION_VPS_Y_PRODUCCION.md` + `.github/workflows/deploy.yml` subidos a ESTE repo.
  - Cron auto-deploy instalado en `vps-demo-n2`: `/opt/deploy_update.sh` cada 15 min (pull+build+reload PM2, log en `~/deploy_update.log`) — verificado corriendo solo.
  - Deploy key SSH nueva (`msp_deploy_ed25519`, id GitHub 161079389, read-only) — la vieja pertenecía a misfinanzsvps.
- **MSP expuesta en lab**: port-forward pfSense WAN:3010→192.168.1.250:3010 + pass rule + ufw allow → `http://congregaciontj.duckdns.org:3010/api/health` responde `{"ok":true}` desde fuera. Backup config pfSense: `/root/config.xml.bak-msp-202608231632`.
- **Limpieza disco vps-demo-n2**: 159 MB → 3.3 GB libres (cachés uv/playwright/npm/pip/journals).
- **micongre.duckdns.org en HTTPS**: vhost nginx nuevo en `vps-panel` (.34, VM 210 de pve; acceso `admin` vía salto pfSense — clave Michoacan1, considerar rotar) que hace proxy → lab `192.168.1.250:3010`. Certbot Let's Encrypt con redirect 301 + renovación automática. Producción `congregaciontj.duckdns.org` intacta (.34 → 192.168.1.4:8211).

### Pendiente
- Sin commit pendiente en este repo (todo pushado).

## Sesión Anterior (2026-07-01, sesión 4)
Informes Predicación 3 pestañas estilo S-1 + filtro grupo. Detalle comprimido en historial previo y sessions.jsonl.

## Historial Comprimido
- **Sesión 3** (2026-07-01): módulo Informes completo, Leaflet dark, deaccent search, /close protocol, reconciliación git.
- **Sesión 2** (2026-06-15): dark mode completo (4 commits).
- **Sesión 1** (2026-06-13): bootstrap, auto-assign-service.js motor activo.

## Bugs Conocidos
1. **auto-assign 8/9**: CBS en meetings vs conteo meeting_parts — por diseño (DJ 2026-06-13).
2. ⚠️ `.github/workflows/deploy.yml` de este repo dispara con rama `vps-selfhosted` que NO existe aquí — el runtime real vive en `meeting-scheduler-pro-vps`. Workflow inerte hasta moverlo o crear la rama (ver DJ 2026-08-23).

## Estado Técnico Actual
- `programs.ts` cubre May 18 – Aug 17 2026 (hardcoded); faltan semanas Aug 18+
- Motor asignación: `auto-assign-service.js` (no assignment-engine.ts)
- Lab vps-demo-n2: Node 22, PM2 (meeting-scheduler-pro :3010), ufw activo, disco 83% (3.3G libres)
- Puerto 3000 del lab ocupado por `~/mis-finanzas/server` — no tocar

## Próximos Pasos — Prioridad
1. 🟡 Agregar semanas `programs.ts` Aug 18+ cuando haya programa JW
2. 🟡 Decidir destino del workflow deploy.yml (mover a meeting-scheduler-pro-vps o documentar como inerte)
3. 🟢 Opcional lab: TLS para :3010, env vars AUTH_SECRET si se requiere login real

## Notas Arquitectónicas
- CSS vars dark mode en globals.css; SELECT azules hardcoded (#b4d5eb/#fdfad4 + dark eq)
- field_service_reports upsert user_id+month; users = publicadores
- Conexión lab: sshpass doble salto vía pfSense 207.248.113.8:2223 → devops@192.168.1.250 (credenciales en PROCEDIMIENTO_*.md — rotar)

---
*Actualizado: 2026-08-23*
