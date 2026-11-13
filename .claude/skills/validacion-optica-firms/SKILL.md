---
name: validacion-optica-firms
description: Procedimiento de validación de UraqiVision (M-VALIDACIÓN). Cubre dNBR de Sentinel-2 como referencia principal, focos de calor FIRMS para fechar y clasificar parches, zonas de control, sensibilidad del umbral, revisión visual y cálculo de precisión, exhaustividad y Dice (VC-01 a VC-05, RF-10, RF-11, MC-04, MC-05). Usar al validar resultados, al descargar focos FIRMS o imágenes Sentinel-2, o al escribir validation.json.
---

# Validación con Sentinel-2 y FIRMS

Fuente: §10.3, §12 (MC-04, MC-05), §23.1, RF-10 y RF-11 del documento maestro, y la API de área de FIRMS
(`firms.modaps.eosdis.nasa.gov/api/area/`, consultada el 12 nov 2026). Responsable: Tabata, con apoyo de
Alex (revisa Mimi).

## Qué valida cada cosa (§23.1)

| ID | Prueba | Métrica | Papel |
|---|---|---|---|
| VC-01 | Sentinel-2 dNBR | Precisión, exhaustividad y Dice | **Referencia principal**. Antecedente: Dice 0,59 en banda C (Belenguer-Plomer et al., 2019) |
| VC-02 | Focos FIRMS | % de parches con al menos un foco | **Contexto, no prueba**: los focos también fechan y clasifican |
| VC-03 | Zonas de control | Cambio de HV en bosque sin fuego ni desmonte | Debe ser menor que en las cicatrices |
| VC-04 | Sensibilidad del umbral | Hectáreas con los dos umbrales | Se publica el rango |
| VC-05 | Revisión visual | Muestra de parches contra imagen óptica | Junto con VC-02, alternativa si no hay Sentinel-2 válido |

Si no hay imagen Sentinel-2 limpia (humo o nubes, riesgo de §24), la estación dice **«validación limitada»**
y la página de método explica la alternativa usada (RF-11).

## Sentinel-2 y dNBR

- NBR = (NIR − SWIR2) / (NIR + SWIR2), con las bandas NIR y SWIR2 de Sentinel-2 L2A (B8A o B8, y B12).
  dNBR = NBR antes − NBR después.
- Elige imágenes antes y después del evento con la máscara de nubes y sombras de L2A; descarta los píxeles
  enmascarados en lugar de rellenarlos.
- Reproyecta Sentinel-2 a la grilla del radar **solo para comparar**; el análisis de radar no se remuestrea.
- El **umbral de dNBR** para marcar «quemado» no está en el documento: el equipo lo define en el plan con su
  fuente bibliográfica. No lo inventes.
- Cómo se accede a Sentinel-2 (catálogo, librería) tampoco está fijado: propónlo en el plan y consúltalo,
  porque añade una dependencia (§28).

## Métricas (VC-01)

Comparación píxel a píxel (o parche a parche, dilo) sobre el área válida en ambos productos:

- Precisión = TP / (TP + FP) · Exhaustividad = TP / (TP + FN) · Dice = 2·TP / (2·TP + FP + FN).
- Los píxeles sin dato en cualquiera de los dos **no cuentan**; informa cuántos quedaron fuera.
- Con cero positivos de referencia, la métrica es «no reportada» con su motivo, nunca 0 (RN-13).
- Implementa las métricas como funciones puras con pruebas de datos sintéticos (skill `python-geoespacial`).

## Focos FIRMS (RF-10, MC-04)

- API de área: `/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA]/[DAY_RANGE]/[DATE]`.
  - `SOURCE`: por ejemplo `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`; los `_SP` son
    de procesamiento estándar (preferibles para un periodo pasado, si ya están disponibles).
  - `AREA`: `oeste,sur,este,norte`. `DAY_RANGE`: de 1 a 5 días por petición. `DATE`: `AAAA-MM-DD`.
  - Límite: 5.000 transacciones cada 10 minutos.
- **`MAP_KEY` es un secreto**: va en una variable de entorno, nunca en el código, la URL registrada ni el
  repositorio. Al registrar la consulta, guarda la URL sin la clave.
- Los focos **fechan y clasifican** parches; **no crean** parches (MC-04).
- La capa del mapa muestra cada foco con su fecha y fuente (RF-10); cita FIRMS según su guía (RN-11).

## Zonas de control (VC-03, MC-05)

Los polígonos de control están **pendientes (DP-05, Tabata)**. Hasta que se elijan, no se calcula la
corrección por fenología ni VC-03.

## Qué guardar en `validation.json`

Para cada métrica: valor o «no reportada» con motivo, fecha y fuente de las imágenes usadas, umbral aplicado,
área válida comparada, porcentaje de parches con foco FIRMS (VC-02) y si la validación es completa o limitada.

## Checklist

- [ ] Sentinel-2 antes y después con máscara de nubes; píxeles enmascarados excluidos.
- [ ] Umbral de dNBR documentado con su fuente en el plan.
- [ ] Precisión, exhaustividad y Dice con funciones probadas; sin dato nunca como 0.
- [ ] `MAP_KEY` solo por variable de entorno.
- [ ] FIRMS usado para fechar y clasificar, no para crear parches.
- [ ] «Validación limitada» si no hubo Sentinel-2 válido.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Autoridad de Bosques y Tierra (2026). Boletín oficial 222 de focos de calor** — <https://www.abt.gob.bo/images/2026/Focos%20de%20Calor/2026%2008%2010%20Boletin%20oficial%20222%20MM.pdf>
  Citada en: §10.3, §10.4. Aplica a: RF-03, RF-12, RF-24. Contexto oficial de incendios: cítala en la ficha de Santa Cruz, en las hipótesis de la estación y en Acerca de; es contexto, no validación.
- **Belenguer-Plomer, Tanase, Fernandez-Carrillo y Chuvieco (2019). Burned area detection and mapping using Sentinel-1 backscatter coefficient and thermal anomalies** — <https://doi.org/10.1016/j.rse.2019.111345>
  Citada en: §11.1, §12 (MC-08), §23.1 (VC-01). Aplica a: MC-03, MC-08, VC-01, RF-11, RF-15. Cítala en la implementación de MC-03 y MC-08, en las métricas de VC-01 y en la página de método. El Dice de 0,59 es de banda C: no lo presentes como meta ni como resultado de banda L.
- **Fundación Amigos de la Naturaleza (s. f.). SATRIFO: Sistema de alerta temprana de riesgo de incendios forestales** — <https://incendios.fan-bo.org/Satrifo/mapa-interactivo/>
  Citada en: §10.3. Aplica a: RF-03, RF-12. Contexto de áreas quemadas históricas para fichas e hipótesis; no sustituye la validación de §23.1.
- **Maillard et al. (2022). Phenology patterns and postfire vegetation regeneration in the Chiquitania region of Bolivia using Sentinel-2** — <https://doi.org/10.3390/fire5030070>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-05, VC-01, VC-03. Fenología del bosque chiquitano con Sentinel-2: respaldo de la corrección por fenología (MC-05) y de las zonas de control (VC-03); el documento no la cita en el cuerpo.
- **Servicio Nacional de Meteorología e Hidrología (2026). Pronóstico de focos de calor en Bolivia** — <https://senamhi.gob.bo/focoscalor/2026/FC_7_JULIO_2026/Pron_Focos_Bolivia_20260713.pdf>
  Citada en: §10.3, §10.4. Aplica a: RF-03, RF-12, RF-24. Cítala en las fichas que usen el pronóstico de focos y en Acerca de; es contexto (un pronóstico), no un resultado ni una validación (RN-10).

<!-- referencias:fin -->
