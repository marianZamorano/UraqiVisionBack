---
name: documento-maestro
description: Navega el documento maestro de UraqiVision (fuente de verdad) para encontrar requisitos y reglas por identificador (RF, RNF, MC, RN, CQ, VC, PS, CU, HU, DP), comprobar si una función está en el alcance del MVP y clasificar una afirmación como hecho, propuesta, hipótesis o pendiente. Usar antes de diseñar o implementar algo, cuando se cite un identificador o cuando haya dudas de alcance.
---

# Documento maestro de UraqiVision

La fuente de verdad es `docs/UraqiVisionDocumentoMaestrov1.1.pdf` (v1.1, 14 nov 2026). Para buscar usa
`docs/UraqiVisionDocumentoMaestrov1.1.txt`: es texto extraído y **las tablas salen con una celda por
línea**, así que lee varias líneas después de cada coincidencia. Si el texto y el PDF difieren, manda el PDF.

## Mapa del documento

| Necesito… | Sección | Identificadores |
|---|---|---|
| Alcance del MVP y exclusiones | §8 | — |
| Objetivos | §5 | OE1–OE6 |
| Datos NISAR, escenas verificadas, fuentes | §10 | — |
| Las dos preguntas de la estación | §11 | — |
| Métodos científicos y orden del procesamiento | §12 | MC-01–MC-09 |
| Requisitos funcionales (con prioridad MVP/Plus/Futuro) | §13 | RF-01–RF-40 |
| Requisitos no funcionales | §14 | RNF-01–RNF-12 |
| Casos de uso e historias | §15 | CU-01–CU-06, HU-01–HU-07 |
| Reglas del negocio y de los datos | §16 | RN-01–RN-14 |
| Arquitectura, flujo de datos, estructura de una estación | §17 | — |
| Tecnologías | §18 | — |
| Módulos, responsables y revisores | §19 | M-INGESTA … M-INTERFAZ |
| Reglas de visualización | §20 | — |
| Insight (contrato y adaptador) | §21 | — |
| Almacenamiento sin pérdida | §22 | — |
| Validación científica, controles de calidad, pruebas | §23 | VC-01–VC-05, CQ-01–CQ-06, PS-01–PS-09 |
| Riesgos | §24 | — |
| Plan del hackathon y demo | §25–§26 | — |
| Reglas para asistentes de IA | §28 | — |
| Decisiones pendientes | §29 | DP-01–DP-08 |
| Glosario y referencias | §30–§31 | — |

## Cómo buscar

```bash
# Un identificador y su contexto (la tabla continúa en las líneas siguientes)
grep -n -A 12 "RF-16" docs/UraqiVisionDocumentoMaestrov1.1.txt
# Todas las apariciones de un tema
grep -n -i "polarizaci" docs/UraqiVisionDocumentoMaestrov1.1.txt
```

## ¿Está en el alcance?

1. Busca la función en §13. Si tiene prioridad **MVP**, está en el alcance del hackathon.
2. **Plus**: solo si sobra tiempo y el equipo lo pide. **Futuro**: no se construye ahora.
3. Si aparece en §8.2 «Fuera del MVP» (procesamiento a pedido, alertas, InSAR, estación Tunari, inundaciones
   del Beni, pronósticos, cuentas de usuario, bases de datos), **no se hace**.
4. Si no aparece en ningún lado, no está decidido: pregunta al equipo en lugar de suponer.
5. Si depende de una DP abierta (§29), detente y dilo: p. ej. el hospedaje (DP-06), los límites de Insight
   (DP-04), la capa `mask` del GCOV (DP-03) o el mapa base del globo (DP-07).

## Clasificar una afirmación

| Clase | Cómo reconocerla | Cómo escribirla |
|---|---|---|
| Hecho verificado | Tiene fuente y fecha de consulta en el documento | Con su fuente y fecha |
| Propuesta de diseño | «Propuesta de diseño del equipo» (p. ej. §17.3, §21.1) | Puede ajustarse; el cambio se registra en el documento |
| Hipótesis | «Hipótesis:» (§11, RN-05) | Siempre marcada como hipótesis y con fuente |
| Pendiente | Tabla de §29 | No se implementa hasta resolverse |

## Salida esperada

Cuando respondas con esta skill, cita la sección y el identificador (p. ej. «§13, RF-08, MVP») y aclara a
qué clase pertenece cada afirmación.
