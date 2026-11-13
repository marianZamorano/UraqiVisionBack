---
name: ciencia-radar-nisar
description: Reglas científicas para el pipeline de UraqiVision con NISAR L2 GCOV en banda L (HH, HV), métodos MC-01 a MC-09, controles de calidad CQ-01 a CQ-06 y validación VC-01 a VC-05. Usar al escribir o revisar código Python de ingesta, línea base, cociente de HV, parches, fenología, clases de parche, hectáreas o validación con Sentinel-2 y FIRMS.
---

# Ciencia de radar NISAR en UraqiVision

Fuente: §9, §10, §11, §12 y §23 del documento maestro. Todo lo que no esté allí se consulta; no se
suponen capacidades del satélite ni valores de las capas.

## Datos

- Producto: **NISAR L2 GCOV**. PROVISIONAL `C2854338529-ASF` (CRID P05023) y VALIDATED `C3622241360-ASF`
  (CRID P05036). Nunca BETA.
- Polarizaciones: HHHH y HVHV (modo DHDH) o solo HH (SHSH) según órbita y fecha. Capas de apoyo: `mask`,
  `numberOfLooks`, `rtcGammaToSigmaFactor`. **Qué codifica `mask` está pendiente (DP-03)**: no lo supongas.
- Hueco permanente del instrumento: 27 de julio al 10 de agosto de 2026. Los eventos analizados son
  posteriores al 10 de agosto.
- Acceso con Earthdata Login (asf_search, earthaccess). Las credenciales viven en `~/.netrc` o variables de
  entorno; **nunca** se leen, imprimen ni versionan.

## Orden obligatorio del procesamiento (§12)

1. Leer HHHH y HVHV en **potencia lineal**.
2. Aplicar la máscara y los controles CQ-01 a CQ-06.
3. Promediar **en lineal** hasta unos 60 m (speckle, MC-01).
4. Línea base = **mediana** por píxel de al menos 3 fechas previas compatibles (MC-02).
5. Convertir línea base y fecha objetivo a dB: `10·log10(potencia)`.
6. Cambio de HV = HV(fecha) en dB − HV(línea base) en dB (MC-03).
7. Dos umbrales (rango de sensibilidad) y área mínima de 1 ha (MC-04).
8. Una de cuatro clases por parche (MC-06).

Errores típicos que esta skill debe frenar:

- Promediar en dB. Los promedios y la mediana se calculan en lineal; el dB es solo para comparar y mostrar.
- Comparar fechas de órbitas o grillas distintas (RN-01). Una serie = una órbita = una grilla.
- Mezclar PROVISIONAL y VALIDATED en la misma serie (RN-02) sin la armonización documentada.
- Remuestrear los datos de análisis. Solo las vistas se remuestrean (§22).
- Rellenar sin-dato con 0. Se usa `NaN` o máscara y se informa como «no reportada» (RN-13).
- Usar los focos FIRMS para **crear** parches. Solo los fechan y clasifican (MC-04).

## Métodos

| ID | Clave | Cuidado |
|---|---|---|
| MC-01 | Misma órbita y grilla; pila float32 lineal a ~60 m con máscara de válidos | Artefactos en bordes de PROVISIONAL: recortar lejos de los bordes |
| MC-02 | Mediana de HV lineal, ≥ 3 fechas previas | Pocas fechas por el inicio en junio y el hueco |
| MC-03 | Cociente de HV en dB, dos umbrales calibrados con controles y dNBR | Umbrales dependen de zona y fecha |
| MC-04 | Parches ≥ 1 ha con fecha de primera detección | Los menores se descartan |
| MC-05 | Cambio relativo a polígonos de control sin fuego ni desmonte | Polígonos pendientes (DP-05) |
| MC-06 | Orden temporal HV/focos y forma del parche → 4 clases | Las clases **no confirman causas** |
| MC-07 | Hectáreas = píxeles × área de píxel en UTM, con rango de los dos umbrales | Depende del umbral |
| MC-08 | RXD (Mahalanobis), **Plus** | Solo si sobra tiempo |
| MC-09 | Clasificador scikit-learn con dNBR, **Plus** | No clasifica desmonte |

Las cuatro clases (RN-05), con estos nombres exactos: *compatible con quema*, *compatible con pérdida previa
de estructura*, *evidencia ambigua*, *datos insuficientes*.

## Controles antes de publicar (CQ, §23.2)

CQ-01 geometría (CRS, grilla, resolución, extensión) · CQ-02 órbita (track, dirección, separación) ·
CQ-03 radiometría (producto, gamma-cero, unidades, rango físico) · CQ-04 polarizaciones (HH y HV en cada
fecha; si falta HV, la vista HV se deshabilita) · CQ-05 porcentaje de datos válidos · CQ-06 procedencia
(gránulos, CRID, sumas de verificación, versión del pipeline). El resultado va a `quality.json`.
Una fecha excluida siempre lleva su motivo (RF-07).

## Validación (VC, §23.1)

VC-01 precisión, exhaustividad y Dice frente al dNBR de Sentinel-2 (referencia: Dice 0,59 en banda C,
Belenguer-Plomer et al., 2019) · VC-02 % de parches con foco FIRMS (contexto, no prueba) · VC-03 zonas de
control · VC-04 sensibilidad del umbral · VC-05 revisión visual. Sin imagen Sentinel-2 válida, la estación
dice **«validación limitada»** (RF-11).

## Pruebas (PS-01, PS-02)

- Unitarias con pytest y **datos sintéticos** pequeños (arrays NumPy hechos a mano) para dB, promedio de
  speckle, mediana, cociente de HV y hectáreas. Los valores esperados se calculan a mano, no con la misma
  función que se prueba.
- Caso obligatorio: un píxel `NaN` en una fecha no debe convertirse en cero ni contaminar la mediana.
- PS-02: el COG publicado conserva exactamente los valores del análisis (comparar arrays con igualdad exacta).

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). NISAR data user guide** — <https://nisar-docs.asf.alaska.edu/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RF-26, RF-37, RN-02, CQ-02, CQ-06. Guía de uso de los productos NISAR (GCOV, madurez, CRID, órbitas) que respaldan §10.1: cítala donde se busca, lee y describe el producto, y en la página de método.
- **Belenguer-Plomer, Tanase, Fernandez-Carrillo y Chuvieco (2019). Burned area detection and mapping using Sentinel-1 backscatter coefficient and thermal anomalies** — <https://doi.org/10.1016/j.rse.2019.111345>
  Citada en: §11.1, §12 (MC-08), §23.1 (VC-01). Aplica a: MC-03, MC-08, VC-01, RF-11, RF-15. Cítala en la implementación de MC-03 y MC-08, en las métricas de VC-01 y en la página de método. El Dice de 0,59 es de banda C: no lo presentes como meta ni como resultado de banda L.
- **Fundación Amigos de la Naturaleza (2023). Deforestación en Bolivia 1956–2022** — <https://fan-bo.org/wp-content/uploads/2024/08/Deforestacionen-Bolivia-1956-2022.pdf>
  Citada en: §4.2, §10.3, §11. Aplica a: RF-01, RF-03, RF-12, RF-13, MC-06. Cítala en la portada, en la ficha de Santa Cruz, en el relato y las hipótesis de San Ignacio y como contexto de la pregunta 2 (quema o desmonte).
- **Maillard (2023). Post-fire natural regeneration trends in Bolivia: 2001–2021** — <https://doi.org/10.3390/fire6010018>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03, RF-12. Regeneración después del fuego en Bolivia: contexto de «recuperación del bosque» de la ficha de Santa Cruz (§10.4) y de las hipótesis; el documento no la cita en el cuerpo.
- **Maillard et al. (2022). Phenology patterns and postfire vegetation regeneration in the Chiquitania region of Bolivia using Sentinel-2** — <https://doi.org/10.3390/fire5030070>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-05, VC-01, VC-03. Fenología del bosque chiquitano con Sentinel-2: respaldo de la corrección por fenología (MC-05) y de las zonas de control (VC-03); el documento no la cita en el cuerpo.
- **NISAR (2025). NASA-ISRO SAR (NISAR) mission science users' handbook (2.ª ed.)** — <https://doi.org/10.48577/jpl.UD4HV3>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RN-11, RF-08, RF-15, RF-19, RF-24, RF-16. Fundamentos de la misión y del radar (§9): respalda el texto de qué resalta cada polarización (RF-08), el glosario (RF-19), la página de método y las citas de datos (RN-11, RF-24) y las explicaciones de Insight; el documento no la cita en el cuerpo.

<!-- referencias:fin -->
