# Estructura común de un SDD de UraqiVision

Todo SDD de `sdd/` (uno por área de §19, más el de proyecto y el de integración) sigue **esta estructura**. La
valida `npm run sdd:validar`, y el hook pre-commit bloquea un commit que la rompa (`[uraqi-guard:sdd-invalido]`).
La fuente de verdad es el documento maestro (`docs/UraqiVisionDocumentoMaestrov1.1.pdf`, copia `.txt`): un SDD
**descompone** el documento en prompts ejecutables, no lo reescribe. Si un SDD contradice el documento, se corrige
el SDD.

## Frontmatter

```yaml
---
id: M-MAPA                 # módulo de §19 (tipo modulo), PROYECTO o INTEGRACION
titulo: Mapa de análisis 2D
tipo: modulo               # proyecto | modulo | integracion
prefijo: MAPA              # los prompts se llaman P-<prefijo>-NN
spec: specs/002-mapa-analisis   # carpeta de Spec Kit que produce (o «—»)
---
```

## Secciones obligatorias, en este orden

| # | Sección | Qué contiene |
|---|---|---|
| 1 | `## 1. Ficha` | Responsable, apoyo y revisor según §19 (o §25 si el área no está en §19), repositorio, spec y momento del plan del hackathon. |
| 2 | `## 2. Alcance del documento maestro` | Requisitos con su identificador y prioridad (MVP, Plus, Futuro) tal como los fija §13; lo que queda fuera (§8.2). |
| 3 | `## 3. Reglas y decisiones que aplican` | Reglas de §16 (RN), no funcionales (RNF), métodos (MC) y decisiones pendientes de §29 que no se implementan hasta resolverse. |
| 4 | `## 4. Contratos e integración` | Qué consume y qué produce el área (§17.3 archivos publicados, §21.1 Insight) y con qué otras áreas se coordina. |
| 5 | `## 5. Calidad: pruebas y aceptación` | Pruebas de §23.3 (PS), validación (VC) y controles (CQ), y criterios de aceptación de §13. |
| 6 | `## 6. Herramientas del repositorio` | Skills, subagentes, servidores MCP y hooks que intervienen. |
| 7 | `## 7. Riesgos y pendientes` | Riesgos de §24 que tocan al área, decisiones pendientes y discrepancias del documento que el equipo debe aclarar. |
| 8 | `## 8. Secuencia de prompts` | Los prompts, en orden, con el formato de abajo. |
| 9 | `## 9. Definición de terminado` | Lista de comprobación para dar el área por terminada. |

## Formato de cada prompt (sección 8)

````markdown
### P-MAPA-01 · Especificar
- **Orden:** 8
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Joaco
- **Revisa:** Marian
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado (§25)
- **Produce:** specs/002-mapa-analisis/spec.md
- **Herramientas:** skills `globo-y-mapa`; subagente `guardian-alcance`; MCP `context7`
- **Verificación:** cada requisito de la spec conserva su identificador; `npm run sdd:validar`

```text
[SDD P-MAPA-01] /speckit-specify …
```
````

Reglas del formato:

- **Orden** es el lugar del prompt en el orden global del repositorio (la tabla de `sdd/README.md` se genera de
  aquí). Una dependencia siempre tiene un Orden menor.
- **Comando** es la skill que invoca el prompt (`speckit-*`, `entrega-hackathon`, `flujo-issues-y-pr`…), y el
  prompt debe invocarla (`/speckit-specify`).
- **Ejecuta** nombra a personas de §19 (o «Equipo»). Si otra persona lo ejecuta, es **apoyo** a su rol y los hooks
  lo avisan.
- El prompt empieza con su etiqueta `[SDD P-…]`: así los hooks saben qué prompt se está ejecutando.
- Los prompts se escriben con la sintaxis de Claude Code (`/speckit-x`). `npm run sdd:siguiente -- --asistente
  codex|gemini|opencode` los adapta (`$speckit-x`, `/speckit.x`).

## Cambiar un prompt

Un prompt se puede cambiar: el equipo descubre cosas al implementar. Se cambia **en su archivo** (rama con issue y
PR, como todo), y la ejecución queda en el historial (`sdd/historial/`) con la decisión «modificar» y el motivo.
Si un prompt ya ejecutado cambia, o se vuelve a ejecutar una dependencia, `npm run sdd:estado` lo marca como
**conflicto** para revisarlo.
