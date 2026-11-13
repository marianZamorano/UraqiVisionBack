---
name: rigor-y-fuentes
description: Reglas de rigor para los contenidos de UraqiVision (fichas del atlas, hipótesis, relato local, página de método, Acerca de, láminas y textos de Insight). Fuentes con fecha de consulta, citas APA 7, cita de datos NISAR y FIRMS, hechos frente a hipótesis, sin cifras ni referencias inventadas y sin marcas de la NASA en contenido generado con IA. Usar al redactar o revisar cualquier texto con datos, cifras, fuentes o referencias.
---

# Rigor y fuentes

Fuente: §1, §4.2, §6.1, §10.3, §10.4, §31, RN-03, RN-05, RN-11, RN-12 y §28.

## Reglas

1. **No inventes** cifras, fechas, fuentes, autores, DOI, URL ni resultados (§28). Si un dato no está en el
   documento maestro ni en una fuente que puedas citar, escribe «dato no disponible» y avisa.
2. Cada cifra muestra **fuente, fecha y método** (RN-03). Las de fuentes web llevan **fecha de consulta**.
3. Las causas del cambio son **hipótesis con fuente** (RN-05). Usa «compatible con», «sugiere»,
   «hipótesis»; nunca «demuestra» o «fue causado por».
4. Un resultado negativo se informa como hallazgo (§6.1: ciencia honesta).
5. Datos NISAR citados según la guía de uso y citación de datos de la NASA (RN-11). Verifica la guía
   vigente antes de escribir la cita; no la reconstruyas de memoria.
6. **Ningún contenido generado con IA usa logos ni marcas de la NASA**, y las imágenes generadas con IA
   llevan marca de agua (RN-12).
7. Referencias en **APA 7**, como en §31. Un DOI o una URL solo se escribe si está en §31 o lo verificaste
   abriendo la fuente.
8. Los textos visibles van en español e inglés (RNF-03): la traducción conserva cifras, fechas y matices
   («compatible con» no se convierte en «caused by»).

## Fichas del atlas (RF-03, §10.4)

Cada ficha de departamento tiene: fenómeno, número de escenas NISAR (de §10.2/§10.4, con la fecha de la
consulta al catálogo CMR, 12 nov 2026), al menos una fuente boliviana y su estado (*estación* o *ficha*).
Los departamentos sin estación dicen «sin estación disponible». Usa exactamente las fuentes de §10.4
(FAN, ABT, SENAMHI, MapBiomas Bolivia, MAAP, IRD e IHH-UMSA, Gobernación) y sus referencias de §31.

## Antes de entregar un texto

- [ ] Cada cifra tiene fuente y fecha, y coincide con el documento maestro o con el archivo publicado.
- [ ] Cada hipótesis está marcada como tal y cita una fuente.
- [ ] Ninguna referencia, DOI o URL es inventada.
- [ ] Existe la versión en inglés con el mismo contenido.
- [ ] Sin logos ni marcas de la NASA en material generado con IA.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Autoridad de Bosques y Tierra (2026). Boletín oficial 222 de focos de calor** — <https://www.abt.gob.bo/images/2026/Focos%20de%20Calor/2026%2008%2010%20Boletin%20oficial%20222%20MM.pdf>
  Citada en: §10.3, §10.4. Aplica a: RF-03, RF-12, RF-24. Contexto oficial de incendios: cítala en la ficha de Santa Cruz, en las hipótesis de la estación y en Acerca de; es contexto, no validación.
- **Belenguer-Plomer, Tanase, Fernandez-Carrillo y Chuvieco (2019). Burned area detection and mapping using Sentinel-1 backscatter coefficient and thermal anomalies** — <https://doi.org/10.1016/j.rse.2019.111345>
  Citada en: §11.1, §12 (MC-08), §23.1 (VC-01). Aplica a: MC-03, MC-08, VC-01, RF-11, RF-15. Cítala en la implementación de MC-03 y MC-08, en las métricas de VC-01 y en la página de método. El Dice de 0,59 es de banda C: no lo presentes como meta ni como resultado de banda L.
- **Bonafilia, Tellman, Anderson e Issenberg (2020). Sen1Floods11** — <https://doi.org/10.1109/CVPRW50498.2020.00113>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03. Antecedente de detección de inundaciones con radar (el documento no la cita en el cuerpo): solo como contexto de la ficha del Beni o de la evolución futura (§27); las inundaciones del Beni están fuera del MVP (§8.2).
- **Correo del Sur (2026, 20 de julio). Cochabamba registra 37 incendios forestales y más de 1.200 hectáreas afectadas en 2026** — <https://correodelsur.com/sociedad/20260720/cochabamba-registra-37-incendios-forestales-y-mas-de-1-200-hectareas-afectadas-en-2026.html>
  Citada en: §4.2. Aplica a: RF-01, RF-03. Fuente del dato de Cochabamba en la portada o en la ficha de Cochabamba (Tunari): cítala con su fecha junto a la cifra (RN-03).
- **Correo del Sur (2026, 27 de octubre). Bolivia reporta menos del 1% de afectación por incendios forestales respecto a años críticos** — <https://correodelsur.com/sociedad/20261027/bolivia-reporta-menos-del-1-de-afectacion-por-incendios-forestales-respecto-a-anos-criticos.html>
  Citada en: §4.2. Aplica a: RF-01. Fuente de las cifras nacionales del problema en la portada: cítala con su fecha junto a la cifra (RN-03).
- **eju.tv (2026, 21 de julio). Bolivia cierra este martes con 2.835 focos de calor; Santa Cruz el más afectado** — <https://eju.tv/?p=5043100>
  Citada en: §4.2. Aplica a: RF-01, RF-13. Fuente del dato de focos de San Ignacio en la portada y el relato de la estación: cítala con su fecha; es contexto del problema, el análisis radar usa eventos posteriores al 10 de agosto (§11).
- **Fricker et al. (2005). Assessment of ICESat performance at the Salar de Uyuni, Bolivia** — <https://doi.org/10.1029/2005GL023423>
  Citada en: §10.4. Aplica a: RF-03. Cítala en la ficha de Potosí.
- **Fundación Amigos de la Naturaleza (2023). Deforestación en Bolivia 1956–2022** — <https://fan-bo.org/wp-content/uploads/2024/08/Deforestacionen-Bolivia-1956-2022.pdf>
  Citada en: §4.2, §10.3, §11. Aplica a: RF-01, RF-03, RF-12, RF-13, MC-06. Cítala en la portada, en la ficha de Santa Cruz, en el relato y las hipótesis de San Ignacio y como contexto de la pregunta 2 (quema o desmonte).
- **Fundación Amigos de la Naturaleza (s. f.). SATRIFO: Sistema de alerta temprana de riesgo de incendios forestales** — <https://incendios.fan-bo.org/Satrifo/mapa-interactivo/>
  Citada en: §10.3. Aplica a: RF-03, RF-12. Contexto de áreas quemadas históricas para fichas e hipótesis; no sustituye la validación de §23.1.
- **Los Tiempos (2026, 10 de julio). Cuatro incendios afectaron al Parque Tunari en lo que va del año** — <https://www.lostiempos.com/actualidad/cochabamba/20260710/cuatro-incendios-afectaron-al-parque-tunari-que-va-del-ano>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03. Fuente de prensa para la ficha de Cochabamba y Tunari (§10.4: «Gobernación (prensa)», §11.3).
- **Maillard (2023). Post-fire natural regeneration trends in Bolivia: 2001–2021** — <https://doi.org/10.3390/fire6010018>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03, RF-12. Regeneración después del fuego en Bolivia: contexto de «recuperación del bosque» de la ficha de Santa Cruz (§10.4) y de las hipótesis; el documento no la cita en el cuerpo.
- **Maillard et al. (2022). Phenology patterns and postfire vegetation regeneration in the Chiquitania region of Bolivia using Sentinel-2** — <https://doi.org/10.3390/fire5030070>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-05, VC-01, VC-03. Fenología del bosque chiquitano con Sentinel-2: respaldo de la corrección por fenología (MC-05) y de las zonas de control (VC-03); el documento no la cita en el cuerpo.
- **Oakes, Hardy, Bunting y Rosenqvist (2024). RadWet-L** — <https://doi.org/10.3390/rs16122078>
  Citada en: §27. Aplica a: RF-03. Evolución futura (§27): solo como contexto de la ficha del Beni; no implementes la estación del Beni en el MVP (§8.2).
- **Ovando et al. (2016). Extreme flood events in the Bolivian Amazon wetlands** — <https://doaj.org/article/1c212c78528541e28a5421fbd6b2ef09>
  Citada en: §10.4. Aplica a: RF-03. Cítala en la ficha del Beni.
- **Rabatel et al. (2013). Current state of glaciers in the tropical Andes** — <https://doi.org/10.5194/tc-7-81-2013>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03. Contexto de la ficha de La Paz (glaciares de la Cordillera Real, §10.4); el documento no la cita en el cuerpo.
- **Satgé et al. (2017). Role of climate variability and human activity on Poopó Lake droughts between 1990 and 2015** — <https://doi.org/10.3390/rs9030218>
  Citada en: §10.4. Aplica a: RF-03. Cítala en la ficha de Oruro.
- **Servicio Nacional de Meteorología e Hidrología (2026). Pronóstico de focos de calor en Bolivia** — <https://senamhi.gob.bo/focoscalor/2026/FC_7_JULIO_2026/Pron_Focos_Bolivia_20260713.pdf>
  Citada en: §10.3, §10.4. Aplica a: RF-03, RF-12, RF-24. Cítala en las fichas que usen el pronóstico de focos y en Acerca de; es contexto (un pronóstico), no un resultado ni una validación (RN-10).
- **Servicio Nacional de Meteorología e Hidrología (2026). Pronóstico hidrológico** — <https://senamhi.gob.bo/meteorologia/boletines/pronostico_hidrologico/2026/JULIO/RESUMEN%20EN%20PLANILLA%20PRON%C3%93STICO%20HIDROL%C3%93GICO%20SENAMHI%20LUNES%2027-07-2026.pdf>
  Citada en: §10.3, §10.4. Aplica a: RF-03, RF-24. Cítala en las fichas que usen el pronóstico hidrológico (inundaciones o sequía) y en Acerca de; es contexto, no un resultado.

<!-- referencias:fin -->
