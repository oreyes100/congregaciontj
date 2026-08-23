# Reunión Entre Semana — Vida y Ministerio Cristianos

Estructura de la reunión semanal de congregación, reflejada en la UI y el schema.

## Flujo de la Sesión

1. Sidebar izquierdo: iconos de navegación (reuniones, personas, territorios, etc.)
2. Sidebar secundario: meses → semanas (acordeón colapsable)
3. Panel central: formulario estructurado con las 3 secciones coloreadas

## Componentes UI

| Archivo | Propósito |
|---|---|
| `Sidebar.tsx` | Iconos + acordeón meses/semanas |
| `MeetingDashboard.tsx` | Formulario principal de asignación |
| `MeetingOverview.tsx` | Vista general/resumen |
| `PrintModal.tsx` | Impresión S-140 + S-89 + Programa (paleta La Estación) |

## Temas Visuales

- **Modo oscuro**: Clase `.dark` en `<html>`, toggle via ThemeProvider → localStorage
- CSS variables semánticas en `globals.css`
- `bg-[#b4d5eb]` → SELECT asignado (dark: `bg-[#1e3a4a]`)
- `bg-[#fdfad4]` → SELECT estado alternativo (dark: `bg-[#3a3a1a]`)

## Reunión de Fin de Semana

- `WeekendDashboard.tsx` — Discurso público
- `WeekendPrintModal.tsx` — Impresión (tarjetas default o tabla)
- Speaker: local, visitante u otro
- `WeekendSpeakerType = 'local' | 'visiting' | 'other'`

## Ver también
- [[Programs-Catalogo]]
- [[Arquitectura-Supabase]]
