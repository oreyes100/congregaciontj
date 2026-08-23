# Catálogo de Programas — Programs.ts

`src/lib/programs.ts` es el SSOT del programa "Vida y Ministerio Cristianos". Hardcoded, no editable por accidente.

## Estructura

```typescript
interface Program {
  weekLabel: string        // "May 25-31"
  mondayDate: string       // ISO "2026-05-25"
  sourceUrl: string        // link WOL
  songOpening, songMiddle, songClosing: number
  parts: ProgramPart[]
}
```

## Las 3 Secciones del Programa

### Tesoros de la Palabra de Dios (gris)
1. Discurso de Tesoros (10 min) — `treasures_talk`, speaker
2. Perlas Espirituales (10 min) — `spiritual_gems`
3. Lectura Bíblica (4 min) — `bible_reading`

### Haz tu Ministerio (dorado)
4-6. Partes de estudiante (variable) — `student_part`
- `starting_conversation`, `following_up`, `making_disciples`, `explaining_beliefs`
- Algunas requieren ayudante (`requires_assistant`)

### Vive como Cristiano (carmesí)
7-8. Partes de vida cristiana — `living_part`
9. Estudio Bíblico de Congregación (30 min) — `cbs` (conductor + lector en `meetings.*`)

## Cobertura Actual

May 18 – Aug 17 2026. Se agregan manualmente cuando JW publica el siguiente programa.

## Invariante

- **No editar `programs.ts` sin confirmación explícita del usuario.**
- `getMondayOfWeek(isoDate)` normaliza cualquier fecha ISO al lunes de su semana.

## Ver también
- [[Sesion-Semanal]]
- [[Auto-Asignacion]]
