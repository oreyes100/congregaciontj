# PROCEDIMIENTO DE CONEXIÓN VPS Y PRODUCCIÓN

## 1. DATOS DE CONEXIÓN

- **Servidor VPS**: `congregaciontj.duckdns.org` (IP: `207.248.113.8`)
- **Puerto SSH**: `2223`
- **Usuario**: `admin`
- **Directorio app**: `/opt/msp`
- **Rama Git**: `vps-selfhosted`
- **Dominio**: `congregaciontj.duckdns.org`

## 2. PASOS MANUALES DE DESPLIEGUE

1. **Acceder al servidor VPS**:
   ```bash
   ssh admin@capuvps.duckdns.org -p 2223
   ```

2. **Entrar al directorio de la aplicación**:
   ```bash
   cd /opt/msp
   ```

3. **Actualizar código desde GitHub**:
   ```bash
   git fetch origin vps-selfhosted
   git checkout vps-selfhosted
   git pull origin vps-selfhosted
   ```

4. **Build Next.js**:
   ```bash
   npm run build
   ```

5. **Copiar archivos standalone al destino**:
   ```bash
   cp -r .next/standalone/. /opt/msp/standalone/ 2>/dev/null || true
   cp -r .next/static /opt/msp/standalone/.next/static
   cp -r public /opt/msp/standalone/public
   ```

6. **Reiniciar PM2 con variables de entorno actualizadas**:
   ```bash
   PM2=/home/devops/.npm-global/bin/pm2
   $PM2 restart meeting-scheduler-pro --update-env
   ```

7. **Verificar estado**:
   ```bash
   sleep 3
   STATUS=$($PM2 list 2>&1 | grep meeting-scheduler-pro | grep -c "online" || echo "0")
   if [ "$STATUS" -gt 0 ]; then
     echo "PM2 online"
   else
     echo "WARN: PM2 no está online — revisar: $PM2 logs meeting-scheduler-pro"
   fi
   ```

8. **Health check**:
   ```bash
   HTTP=$(curl -sk --max-time 10 https://congregaciontj.duckdns.org/api/health -w "%{http_code}" -o /dev/null)
   echo "HTTPS /api/health: $HTTP"
   # Si falla, ejecutar: sudo certbot --nginx -d congregaciontj.duckdns.org
   ```

## 3. FLUJO AUTOMÁTICO

### A. GitHub Actions workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - vps-selfhosted

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: vps-selfhosted

      - name: Deploy to VPS
        run: |
          ssh devops@congregaciontj.duckdns.org << 'EOF'
          cd /opt/msp
          git fetch origin vps-selfhosted
          git checkout vps-selfhosted
          git pull origin vps-selfhosted
          npm run build
          cp -r .next/standalone/. /opt/msp/standalone/ 2>/dev/null || true
          cp -r .next/static /opt/msp/standalone/.next/static
          cp -r public /opt/msp/standalone/public
          PM2=/home/devops/.npm-global/bin/pm2
          $PM2 restart meeting-scheduler-pro --update-env
          sleep 3
          STATUS=$($PM2 list 2>&1 | grep meeting-scheduler-pro | grep -c "online" || echo "0")
          if [ "$STATUS" -gt 0 ]; then
            echo "PM2 online"
          else
            echo "WARN: PM2 no está online — revisar logs"
          fi
          HTTP=$($curl -sk --max-time 10 https://congregaciontj.duckdns.org/api/health -w "%{http_code}" -o /dev/null)
          echo "HTTPS /api/health: $HTTP"
          EOF
```

### B. Script local (`auto_deploy.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "📤 1/2 — Haciendo push a GitHub..."
git push origin vps-selfhosted
echo "✓ Push completado"

echo ""
echo "🔧 2/2 — Desplegando en VPS..."
echo ""
echo "Ejecuta ESTOS comandos en el servidor VPS (congregaciontj.duckdns.org):"
echo ""
echo "  # 1. Entrar al directorio de la app"
echo "  cd /opt/msp"
echo ""
echo "  # 2. Actualizar código desde GitHub"
echo "  git fetch origin vps-selfhosted"
echo "  git checkout vps-selfhosted"
echo "  git pull origin vps-selfhosted"
echo ""
echo "  # 3. Build Next.js"
echo "  npm run build"
echo ""
echo "  # 4. Copiar archivos standalone al destino"
echo "  cp -r .next/standalone/. /opt/msp/standalone/ 2>/dev/null || true"
echo "  cp -r .next/static /opt/msp/standalone/.next/static"
echo "  cp -r public /opt/msp/standalone/public"
echo ""
echo "  # 5. Reiniciar PM2 con variables de entorno actualizadas"
echo "  PM2=/home/devops/.npm-global/bin/pm2"
echo "  $PM2 restart meeting-scheduler-pro --update-env"
echo ""
echo "  # 6. Verificar estado"
echo "  sleep 3"
echo "  $PM2 list 2>&1 | grep meeting-scheduler-pro | grep -c \"online\" || echo \"0\""
echo ""
echo "  # 7. Health check"
echo "  HTTP=$(curl -sk --max-time 10 https://congregaciontj.duckdns.org/api/health -w "%{http_code}" -o /dev/null)"
echo "  echo \"HTTPS /api/health: $HTTP\""
echo ""
echo "📝 Si el HTTPS falla, ejecuta en el servidor: sudo certbot --nginx -d congregaciontj.duckdns.org"
echo ""
echo "✅ Despliegue completado"
```

## 4. VERIFICACIÓN POST-DESPLiegUE

```bash
# Health check
curl -sk https://congregaciontj.duckdns.org/api/health

# Debería devolver {"ok":true} con código HTTP 200

# Verificar que el agente Telegram esté configurado (opcional):
# ./scripts/setup-telegram-agent.sh https://congregaciontj.duckdns.org
```

## 5. SOLUCIÓN DE PROBLEMAS

| Síntoma | Causa probable | Acción |
|---|---|---|
| **Health check retorna 501** | `TELEGRAM_WEBHOOK_SECRET` no configurado en el VPS | Configurarlo en `/opt/msp/ecosystem.config.js` y `pm2 restart meeting-scheduler-pro --update-env` |
| **Health check retorna 401** | La cabecera `X-Telegram-Bot-Api-Secret-Token` no coincide con `TELEGRAM_WEBHOOK_SECRET` | Re-generar el secret y re-registrar el webhook con `setWebhook` |
| **Health check retorna 200 pero agente no responde** | Agente no configurado o chat no vinculado | Ejecutar `./scripts/setup-telegram-agent.sh` o verificar `messaging_settings` en la BD |
| **PM2 no arranca** | Error en `npm run build` | Revisar logs: `pm2 logs meeting-scheduler-pro` |
| **Dominio no resuelve** | DNS pendiente actualización | Esperar a que DuckDNS propague o verificar `A` record en el proveedor DNS |

---

**Última actualización**: 2026-08-22

---

*Este documento forma parte de la base de conocimiento del proyecto y debe mantenerse actualizado con cada cambio significativo en la infraestructura o el flujo de despliegue.*