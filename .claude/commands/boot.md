---
description: Inicio de sesión. Lee Contexto Activo y reporta estado mínimo.
---

Lee el archivo `.claude/memory/Contexto Activo.md` y responde en este formato exacto:

```
[YYYY-MM-DD] Meeting Scheduler Pro — Listo.

Estado: [últimas 3 tareas completadas o en curso — máx 1 línea cada una]
Bugs conocidos: [bugs del Contexto Activo — solo los abiertos]
Próximo paso: [acción concreta según "Próximos Pasos — Prioridad"]
Stack: Next.js + Supabase | Puerto dev: 3000
```

Luego pregunta: "¿Continuamos con [próximo paso] o tienes otra prioridad?"

No cargues ningún otro archivo hasta que la tarea lo requiera.
