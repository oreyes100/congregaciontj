# War-game: Aislamiento por congregación + correcciones en /weekend

> Ejecutor: corre los movimientos en orden. Antes de cada movimiento, lee sus señales de fallo. Revisa las condiciones de aborto después de cada movimiento.

## Objetivo de la misión

Cada administrador de congregación debe ver y modificar **únicamente** los datos de su propia congregación, en todos los módulos. Además, el módulo `/weekend` debe (a) dejar de arrojar error cuando un admin elige cualquier semana, y (b) abrir con la semana actual seleccionada y visible en la parte superior del panel de semanas, con semanas previas y posteriores accesibles por scroll.

Criterios medibles de éxito:
1. `gabrielreyes@gmail.com` (congregación *Universidad*, Tiripetio) puede crear cualquier semana en `/weekend` sin error, incluso fechas que *La Estación* ya ocupa.
2. `SELECT COUNT(*) FROM weekend_meetings WHERE congregation_id IS NULL` = 0.
3. La restricción de `weekend_meetings` es `UNIQUE(date, congregation_id)`, no `UNIQUE(date)`.
4. Al abrir `/weekend`, la semana actual queda seleccionada y su fila es visible en el tope del panel sin scroll manual.
5. `POST /api/field-service-groups/assign` rechaza (404/403) un `user_id` de otra congregación.

## Resumen del reconocimiento

Hechos establecidos (verificados contra el VPS en producción, `/opt/msp/data/msp.db`):

- **Congregaciones**: `79d06d38-bf21-42d5-946c-955abcef7a43` = La Estación (Pátzcuaro); `b68f2c34-42c3-48fc-a427-7f428cdcd0a0` = Universidad (Tiripetio).
- **Admins**: `oreyes100@gmail.com` → La Estación. `gabrielreyes@gmail.com` → Universidad. Ambos `app_role='admin'`. Nota: el `email` de la fila es un placeholder (`gabriel.<ts>@placeholder.local`); el login real está en `auth_email`.
- **Datos de weekend**: `weekend_meetings` tiene 20 filas, **todas** de La Estación. Universidad tiene **0**.
- **CAUSA RAÍZ del error de Gabriel**: el esquema declara `UNIQUE(date)` — global, sin incluir `congregation_id`. En `src/components/Sidebar.tsx:202`, toda semana sin reunión propia es un placeholder que al hacer clic llama `onNewMeeting(week.isoDate)` → `POST /api/weekend-meetings`. El insert choca con la fila de La Estación en esa fecha → violación UNIQUE. El fallback en `src/app/api/weekend-meetings/route.ts:86-89` busca la fila existente **filtrando por la congregación del usuario**, no la encuentra, y relanza el error → `alert('Error al crear semana')`.
- **Tablas correctamente aisladas** (ya incluyen `congregation_id` en su UNIQUE): `congregation_tasks`, `cleaning_assignments`, `meeting_attendance`. `field_service_reports` usa `UNIQUE(user_id, month)`, correcto porque `user_id` ya está acotado. `users` usa `UNIQUE(email)`/`UNIQUE(username)` globales, correcto para autenticación.
- **`weekend_meetings` es la única tabla con el defecto.**
- **Tablas sin `congregation_id`**: `meeting_parts`, `part_history`, `part_snapshots`, `public_talk_history`, `pw_assignments`, `pw_shifts`, `field_service_group_members` — todas heredan aislamiento vía FK al padre. `public_talk_outlines` es catálogo global compartido (correcto por diseño). `congregations` es la tabla de tenants.
- **BUG ADICIONAL (IDOR)**: `src/app/api/field-service-groups/assign/route.ts` llama `getSessionContext()` pero descarta el resultado y nunca valida que `user_id` ni `group_id` pertenezcan a la congregación del solicitante. Un admin puede reasignar publicadores de otra congregación.
- **Módulo Cuentas**: `src/app/cuentas/page.tsx` es únicamente un `<iframe>` a `https://cuentas-congregacion-bay.vercel.app`. Es una **aplicación externa e independiente**, con su propio login (campos "Nombre de usuario" / "Contraseña" / "Congregación") y su propio backend — todos sus endpoints devuelven 401 sin sesión propia. **No existe su código fuente** ni en el disco local ni en ninguno de los repos de GitHub de la cuenta `oreyes100`.
- **Sidebar `/weekend`**: se invoca con `monthsBack={12}` (`src/app/weekend/page.tsx:216`). El calendario se construye desde `hoy - 12 meses` (`Sidebar.tsx:68`), así que 12 meses de pasado se renderizan **antes** del mes actual, dejándolo enterrado. `activeId` arranca en `null`, por lo que ninguna semana está en foco al cargar.

## Movimientos

### Movimiento 1: Respaldar la base de datos de producción

- **Acción:** En el VPS, `sqlite3 /opt/msp/data/msp.db ".backup /opt/msp/backups/msp-pre-s14-$(date +%Y%m%d-%H%M%S).db"`. Verificar que el archivo existe y pesa lo mismo que el original (±WAL).
- **Observación esperada si funcionó:** el archivo aparece en `/opt/msp/backups/` con tamaño > 0.
- **Observación esperada si falló:** `sqlite3: command not found`, o error de permisos de escritura en `/opt/msp/backups`.
- **Causa más probable de fallo:** el directorio `backups` no existe.
- **Contramovimiento:** `mkdir -p /opt/msp/backups` y reintentar.
- **Consecuencias posteriores:** sin este respaldo, el Movimiento 3 (reconstrucción de tabla) es irreversible. **No avanzar al Movimiento 3 sin respaldo confirmado.**

### Movimiento 2: Corregir el esquema fuente

- **Acción:** En `src/lib/schema.sql`, cambiar la restricción de `weekend_meetings` de `UNIQUE(date)` a `UNIQUE(date, congregation_id)`.
- **Observación esperada si funcionó:** `grep -n "UNIQUE(date" src/lib/schema.sql` muestra `UNIQUE(date, congregation_id)`.
- **Observación esperada si falló:** el grep sigue mostrando `UNIQUE(date)` solo.
- **Causa más probable de fallo:** hay más de una tabla con `UNIQUE(date)` y se editó la equivocada.
- **Contramovimiento:** localizar el bloque `CREATE TABLE weekend_meetings` por número de línea y editar dentro de ese bloque exclusivamente.
- **Consecuencias posteriores:** esto sólo afecta instalaciones nuevas. Las bases existentes necesitan el Movimiento 3.

### Movimiento 3: Migración idempotente que reconstruye la tabla

- **Acción:** SQLite no permite eliminar una restricción con `ALTER TABLE`. Agregar en `src/lib/sqlite.ts`, **después** del bucle `runMigrations`, un bloque guardado que:
  1. Lea `SELECT sql FROM sqlite_master WHERE name='weekend_meetings'`.
  2. Si el resultado **no** contiene `UNIQUE(date, congregation_id)`, ejecute la reconstrucción; si ya lo contiene, no haga nada (idempotencia).
  3. Reconstrucción: `PRAGMA foreign_keys=OFF` → `BEGIN` → crear `weekend_meetings_new` con el esquema corregido → `INSERT INTO weekend_meetings_new SELECT <columnas explícitas> FROM weekend_meetings` → `DROP TABLE weekend_meetings` → `ALTER TABLE weekend_meetings_new RENAME TO weekend_meetings` → recrear `idx_weekend_congre` → `COMMIT` → `PRAGMA foreign_keys=ON`.
- **Observación esperada si funcionó:** tras reiniciar, `SELECT sql FROM sqlite_master WHERE name='weekend_meetings'` incluye `UNIQUE(date, congregation_id)`, y `SELECT COUNT(*) FROM weekend_meetings` sigue siendo 20.
- **Observación esperada si falló:** el arranque lanza `no such table: weekend_meetings`, o el conteo baja de 20, o el log de PM2 muestra `SQLITE_ERROR` en el arranque.
- **Causa más probable de fallo:** usar `SELECT *` en el INSERT. El orden de columnas de la tabla nueva debe coincidir exactamente; `SELECT *` es frágil ante columnas añadidas por migraciones previas. **Listar las columnas explícitamente por nombre en ambos lados.**
- **Contramovimiento:** restaurar el respaldo del Movimiento 1, corregir la lista de columnas y reintentar. Envolver todo el bloque en `try/catch` para que un fallo **no** impida el arranque de la app (el resto de módulos debe seguir funcionando).
- **Consecuencias posteriores:** si esta migración se ejecuta en cada arranque sin la guarda de idempotencia, cada reinicio reconstruiría la tabla — lento y arriesgado. La guarda del paso 2 es obligatoria, no opcional.

### Movimiento 4: Endurecer el POST de weekend-meetings

- **Acción:** En `src/app/api/weekend-meetings/route.ts`, en la rama de colisión UNIQUE (líneas ~85-90), la consulta de fallback ya filtra por congregación — mantenerlo. Añadir que si tras el filtro no se encuentra fila, se devuelva un error explícito y legible en lugar de relanzar el error crudo de SQLite.
- **Observación esperada si funcionó:** con la migración del Movimiento 3 aplicada, el insert ya no colisiona y devuelve 201.
- **Observación esperada si falló:** sigue devolviendo 500 con texto `UNIQUE constraint failed`.
- **Causa más probable de fallo:** la migración del Movimiento 3 no llegó a ejecutarse porque el proceso PM2 no se reinició tras el deploy.
- **Contramovimiento:** `pm2 delete meeting-scheduler-pro && pm2 start ecosystem.config.cjs` (un `restart` simple puede no recargar el módulo nativo ni reabrir la conexión SQLite).
- **Consecuencias posteriores:** ninguna sobre otros módulos.

### Movimiento 5: Cerrar el IDOR de field-service-groups/assign

- **Acción:** En `src/app/api/field-service-groups/assign/route.ts`, capturar `ctx = await getSessionContext()` y, cuando `ctx.congreId` exista, verificar antes de escribir que el `user_id` pertenece a esa congregación y que el `group_id` (si viene) también. Si no, devolver 404.
- **Observación esperada si funcionó:** un POST con un `user_id` de otra congregación devuelve 404 y no modifica `field_service_group_members`.
- **Observación esperada si falló:** el POST sigue devolviendo `{"success":true}` y la fila cambia.
- **Causa más probable de fallo:** el super-admin (`congreId` nulo) queda bloqueado por la verificación.
- **Contramovimiento:** aplicar la verificación **sólo** cuando `ctx.congreId` no sea nulo, dejando paso libre al super-admin.
- **Consecuencias posteriores:** ninguna; la UI siempre envía usuarios de la propia congregación.

### Movimiento 6: Semana actual en foco y al tope del panel

- **Acción:** Dos cambios coordinados:
  1. En `src/app/weekend/page.tsx`, tras cargar los datos, si `activeId` es `null`, seleccionar la reunión cuya fecha cae en la semana actual; si no existe reunión para esa semana, dejar `activeId` en `null` pero marcar la fecha de la semana actual para el scroll.
  2. En `src/components/Sidebar.tsx`, añadir un `ref` a la fila de la semana actual y, al montar, hacer `scrollIntoView({ block: 'start' })` **dentro del contenedor scrollable**, no de la página. Expandir el mes actual (ya lo hace) y garantizar que los meses previos queden por encima para que el scroll hacia arriba los revele.
- **Observación esperada si funcionó:** al abrir `/weekend`, la fila de la semana actual aparece en el borde superior del panel; hay contenido por encima al hacer scroll hacia arriba (meses previos) y por debajo (meses siguientes); la fila actual tiene el resaltado de activo.
- **Observación esperada si falló:** el panel queda arriba del todo mostrando julio de hace 12 meses, o la página entera salta al hacer scroll.
- **Causa más probable de fallo:** `scrollIntoView` sobre un elemento cuyo mes está colapsado (el nodo no está en el DOM todavía), o el scroll se aplica antes de que React pinte las filas.
- **Contramovimiento:** ejecutar el scroll en un `useEffect` que dependa de que el mes actual ya esté expandido y las filas renderizadas; si el nodo aún es `null`, reintentar en el siguiente frame con `requestAnimationFrame`. Usar `block: 'start'` para que quede al tope, no `center`.
- **Consecuencias posteriores:** `Sidebar` es compartido con el módulo de reuniones entre semana (`monthsBack=0`). El cambio debe ser inocuo ahí: si no hay semana pasada que mostrar, el scroll al tope es el comportamiento natural. Verificar `/meetings` después de tocar `Sidebar`.

### Movimiento 7: Compilar antes de desplegar

- **Acción:** `npm run build` en el directorio del proyecto.
- **Observación esperada si funcionó:** termina sin errores y la lista de rutas incluye `/weekend`.
- **Observación esperada si falló:** errores de TypeScript. Sólo aparecen en modo build, nunca en `dev`.
- **Causa más probable de fallo:** tipos del `ref` en `Sidebar` (`HTMLButtonElement` vs `HTMLDivElement`).
- **Contramovimiento:** corregir el tipo del `ref` y recompilar. **No desplegar con el build roto.**
- **Consecuencias posteriores:** ninguna.

### Movimiento 8: Desplegar al VPS sin destruir el binario nativo

- **Acción:** `rsync -az` de `.next/standalone/`, `.next/static/` y `public/` al VPS. **Excluir** `ecosystem.config.cjs` y `data/`. **Nunca usar `--delete`.**
- **Observación esperada si funcionó:** rsync termina sin salida; `/opt/msp/node_modules/better-sqlite3/prebuilds/linux-x64.node` sigue existiendo.
- **Observación esperada si falló:** tras reiniciar, PM2 entra en bucle de reinicios con `Cannot find module '.../better_sqlite3.node'`.
- **Causa más probable de fallo:** usar `--delete`, que borra el binario compilado para Linux y lo sustituye por el de macOS, y además elimina `ecosystem.config.cjs`.
- **Contramovimiento:** en el VPS, `cd /opt/msp && rm -rf node_modules/better-sqlite3 && npm install better-sqlite3@13.0.1 --no-save`, luego recrear `ecosystem.config.cjs` con `HOSTNAME: "0.0.0.0"` y reiniciar.
- **Consecuencias posteriores:** `HOSTNAME` debe permanecer en `0.0.0.0`. El nginx que atiende el puerto 80 corre **dentro de Docker** (contenedor `app-web-1`) y proxya a `172.18.0.1:3000`; si la app se ata a `127.0.0.1` el sitio devuelve 502 Bad Gateway. El `nginx.service` del host está enmascarado y detenido — es normal, no intentar arrancarlo.

### Movimiento 9: Verificación funcional recurrente

- **Acción:** Ejecutar, con sesión iniciada como **cada** admin por separado (cookie jar independiente):
  1. `GET /api/health` → `{"ok":true}`.
  2. `GET /api/weekend-meetings` → contar reuniones; deben ser sólo las de la congregación propia.
  3. `POST /api/weekend-meetings` con una fecha que la **otra** congregación ya ocupa → debe devolver 201, no 500.
  4. Repetir el mismo POST → debe devolver 200 con la reunión existente (idempotente), no un duplicado.
  5. `POST /api/field-service-groups/assign` con un `user_id` de la otra congregación → 404.
  6. `SELECT date, congregation_id, COUNT(*) FROM weekend_meetings GROUP BY date, congregation_id HAVING COUNT(*) > 1` → 0 filas.
- **Observación esperada si funcionó:** los seis puntos pasan para ambos admins.
- **Observación esperada si falló:** cualquier 500, o el punto 6 devuelve filas (duplicados).
- **Causa más probable de fallo:** el proceso no recargó la migración.
- **Contramovimiento:** `pm2 delete` + `pm2 start` y repetir la verificación completa desde el punto 1.
- **Consecuencias posteriores:** si el punto 4 crea duplicados, la rama de colisión UNIQUE del Movimiento 4 quedó mal; revisarla antes de dar por buena la misión.

## Suposiciones sin resolver

1. **Contraseña de administrador del módulo Cuentas — NO DETERMINABLE.** `https://cuentas-congregacion-bay.vercel.app` es una aplicación independiente con su propio backend y su propio almacén de usuarios. No hay código fuente en el disco local ni en ningún repositorio de GitHub de la cuenta `oreyes100`, y todos sus endpoints responden 401. La credencial sólo puede obtenerla el usuario desde el panel de Vercel (variables de entorno del proyecto) o desde la base de datos de esa aplicación. **El ejecutor no debe inventar, adivinar ni intentar forzar esta credencial.**

2. **Aislamiento por congregación dentro de Cuentas — BLOQUEADO.** Ligar Cuentas a una congregación exige modificar esa aplicación externa, cuyo código no está disponible. La página de login de Cuentas ya expone un campo "Congregación", lo que sugiere que algún concepto de congregación existe allí, pero no se puede verificar su semántica sin la fuente. Opciones que el usuario debe decidir:
   - (a) Proporcionar el repositorio de Cuentas para modificarlo.
   - (b) Reconstruir Cuentas como módulo nativo dentro de meeting-scheduler-pro, heredando así el aislamiento y el inicio de sesión único.
   - (c) Dejarlo como está y aceptar que Cuentas gestiona sus propios usuarios y congregaciones por separado.
   Mientras tanto, lo único aplicable del lado de MSP es controlar **quién ve el módulo** (vía `enabled_modules` por congregación en el panel de super-admin), lo que no aísla los datos internos de Cuentas.

3. **Contraseña de `gabrielreyes@gmail.com`** — no está en el contexto, por lo que la verificación del Movimiento 9 como Gabriel requiere que el usuario la proporcione, o bien realizarla mediante consultas SQL directas contra la base y llamadas a la API con una sesión de super-admin.

## Condiciones de aborto

Detenerse y reportar al usuario, sin seguir adelante, si:

- El respaldo del Movimiento 1 no se puede crear o verificar → **no ejecutar el Movimiento 3 bajo ninguna circunstancia.**
- Tras el Movimiento 3, `SELECT COUNT(*) FROM weekend_meetings` devuelve menos de 20 filas → restaurar el respaldo inmediatamente y reportar.
- El build del Movimiento 7 falla tras dos intentos de corrección → reportar el error de TypeScript literal.
- Tras el despliegue, `/api/health` no devuelve `{"ok":true}` en dos reinicios consecutivos → restaurar el respaldo, reportar los logs de PM2 y el estado del binario `better-sqlite3`.
- Cualquier movimiento requeriría adivinar, restablecer o eludir una credencial de la aplicación Cuentas → detenerse y pedirla al usuario.
