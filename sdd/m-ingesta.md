---
id: M-INGESTA
titulo: Búsqueda, recorte y descarga de escenas
tipo: modulo
prefijo: INGESTA
spec: specs/002-ingesta
---

# SDD · M-INGESTA — Búsqueda, recorte y descarga de escenas

El inicio del pipeline: buscar en el catálogo las escenas NISAR L2 GCOV de San Ignacio, recortarlas y extraer HH y
HV a COG en potencia lineal sin pérdida, con su manifiesto y las huellas de las escenas. Sin esto no hay
antes/después real el sábado a las 13:00 (§25).

## 1. Ficha

| Campo | Valor |
|---|---|
| Módulo (§19) | M-INGESTA · «Buscar, recortar y descargar escenas; manifiesto y huellas de las escenas» |
| Responsable | Alex |
| Revisora | Tabata |
| Repositorio | `UraqiVisionBack` (backend) |
| Spec | `specs/002-ingesta` |
| Momento (§25) | Antes: cuentas Earthdata y probar un recorte · Sáb 9:00–13:00 descarga y recorte de San Ignacio · Sáb 14:00–20:00 focos FIRMS y huellas de escenas · Sáb 20:00–24:00 escenas VALIDATED y apoyo a validación |
| Discrepancia del documento | §19 asigna MC-01 a M-INGESTA (Alex); §25 agenda «MC-01 y MC-02» para Tabata el sábado de 9:00 a 13:00. Acuérdenlo antes de P-INGESTA-04 |

## 2. Alcance del documento maestro

| ID | Requisito | Prioridad |
|---|---|---|
| MC-01 | Preparación de la serie (§12): solo escenas de la misma órbita y grilla; GCOV HHHH y HVHV de una órbita con recorte del área; pila en potencia lineal (float32) promediada a unos 60 m, con máscara | MVP |
| RF-26 | Huellas de las escenas NISAR usadas, con órbita, dirección, fechas y polarizaciones; coinciden con los polígonos del catálogo CMR (las dibuja la web; aquí se producen) | MVP |

Flujo de §17.2 (Alex): catálogo CMR/ASF → búsqueda por área, fecha y órbita → lista de gránulos en el manifiesto y
huellas; archivos GCOV en la nube → recorte y extracción de HHHH y HVHV (openSEPPO o GDAL) → COG por fecha en
potencia lineal (float32, sin pérdida). Datos de §10.1 y §10.2. Historia: CU-06. Fuera del área: procesamiento a
pedido de cualquier área (§8.2).

## 3. Reglas y decisiones que aplican

- RN-01 (misma órbita y grilla), RN-02 (sin productos BETA; una sola madurez y un solo CRID por serie; PROVISIONAL y
  VALIDATED como tramos separados), CQ-02 (órbita), CQ-06 (procedencia completa en el manifiesto).
- §22: descargar solo lo necesario (recorte desde la nube), compresión sin pérdida (COG DEFLATE o ZSTD con
  predictor, float32), no guardar originales, no remuestrear el análisis. RNF-09 (integridad).
- RNF-06: las credenciales de Earthdata viven en `.netrc` local; nunca se leen ni se versionan.
- **Pendientes**: DP-08 (Alex y Tabata, sábado a las 9:00): fijar el recorte de 50 × 50 km con los focos FIRMS de
  agosto en adelante. DP-03 (Tabata): qué valores codifica la capa mask del GCOV. No se deciden en un prompt.

## 4. Contratos e integración

- **Produce**: COG por fecha (HHHH y HVHV en potencia lineal) para M-CIENCIA; gránulos, fechas, órbita, CRID y
  sumas de verificación para `manifest.json`; `footprints.geojson` (§17.3) para M-PUBLICACIÓN y la web (RF-26);
  focos FIRMS del periodo para M-VALIDACIÓN (§25).
- **Se coordina con**: M-CIENCIA (grilla, máscara, MC-01), M-VALIDACIÓN (focos y Sentinel-2), M-PUBLICACIÓN
  (manifiesto y huellas).

## 5. Calidad: pruebas y aceptación

- PS-01 (pytest con datos sintéticos; MC-01), PS-02 (los COG conservan los valores: RNF-09).
- CQ-01 (misma geometría en toda la serie), CQ-02 (mismo track y dirección), CQ-04 (HH y HV presentes), CQ-06
  (procedencia completa) se comprueban con M-VALIDACIÓN.
- Criterio de RF-26: las huellas coinciden con los polígonos del catálogo CMR.

## 6. Herramientas del repositorio

- Skills: `ingesta-nisar-asf`, `python-geoespacial`, `notebook-reproducible`, `test-driven-development`,
  `devops-secrets-management`.
- Subagentes: `revisor-cientifico`, `devsecops-engineer`, `revisor-qa`.
- MCP: `context7` (asf_search, earthaccess, GDAL, rasterio).
- Hooks: guardas de `.netrc` y secretos, pre-commit, código vivo en la promoción.

**Referencias del documento maestro (§31)**

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). NISAR data user guide** — <https://nisar-docs.asf.alaska.edu/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RF-26, RF-37, RN-02, CQ-02, CQ-06. Guía de uso de los productos NISAR (GCOV, madurez, CRID, órbitas) que respaldan §10.1: cítala donde se busca, lee y describe el producto, y en la página de método.
- **Alaska Satellite Facility (2026). Open source software packages** — <https://nisar-docs.asf.alaska.edu/using-open-source/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-08. Paquetes de código abierto para trabajar con NISAR (respalda las herramientas de §18): consúltala al elegir y fijar versiones y cítala en el notebook reproducible.
- **Alaska Satellite Facility (2026). Using NISAR data with GDAL** — <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-09. Lectura y recorte del GCOV con GDAL desde la nube (§17.2, §18, §22): cítala en el código de recorte y extracción de HHHH y HVHV.
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).

<!-- referencias:fin -->

## 7. Riesgos y pendientes

- §24: descargas lentas o pesadas → recorte desde la nube y empezar apenas abra el hackathon; hueco permanente de
  datos (27 jul – 10 ago) → eventos de agosto en adelante; escenas VALIDATED con solo HH → HV solo con las órbitas
  que tienen HH y HV; productos PROVISIONAL con artefactos en bordes → recortar lejos de los bordes.
- DP-08 y DP-03 pendientes; discrepancia de MC-01 entre §19 y §25 (ver Ficha).

## 8. Secuencia de prompts

### P-INGESTA-01 · Especificar
- **Orden:** 8
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/002-ingesta/spec.md
- **Herramientas:** skills `documento-maestro`, `ingesta-nisar-asf`
- **Verificación:** cada requisito conserva su identificador; DP-08 y DP-03 marcadas como pendientes

```text
[SDD P-INGESTA-01] /speckit-specify Feature 002-ingesta (número 002, nombre corto ingesta) del backend de UraqiVision, módulo M-INGESTA de §19 (responsable Alex). Buscar en el catálogo CMR/ASF las escenas NISAR L2 GCOV de la estación San Ignacio de Velasco por área, fecha y órbita, recortar el área y extraer HHHH y HVHV a un COG por fecha en potencia lineal, float32 y sin pérdida (§17.2, §22), sin guardar originales; preparar la serie solo con escenas de la misma órbita y grilla (MC-01, RN-01), sin productos BETA y con una sola madurez y un solo CRID, con PROVISIONAL y VALIDATED como tramos separados (RN-02); registrar en el manifiesto gránulos, fechas, órbita, CRID y sumas de verificación (CQ-06); y producir las huellas de las escenas usadas con órbita, dirección, fechas y polarizaciones, que coincidan con los polígonos del catálogo CMR (RF-26). Las credenciales de Earthdata nunca se versionan (RNF-06). El recorte de 50 × 50 km (DP-08) y los valores de la capa mask (DP-03) son decisiones pendientes: no las decidas. Historia CU-06. Fuera de alcance: procesamiento a pedido (§8.2).
```

### P-INGESTA-02 · Aclarar
- **Orden:** 14
- **Fase:** 3 · Aclaraciones
- **Comando:** speckit-clarify
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-01
- **Momento:** Antes del sábado 14
- **Produce:** sección Clarifications de specs/002-ingesta/spec.md
- **Herramientas:** skills `documento-maestro`, `ingesta-nisar-asf`
- **Verificación:** máximo 5 preguntas; pendientes marcados

```text
[SDD P-INGESTA-02] /speckit-clarify Aclara la spec 002-ingesta con un máximo de 5 preguntas, una a la vez, con una opción recomendada basada en el documento maestro (§10.1, §10.2, §12, §22). Prioriza: qué órbita y dirección se usan para San Ignacio, cómo se separan los tramos PROVISIONAL y VALIDATED (RN-02), qué hace el pipeline con una fecha que solo tiene HH (CQ-04), quién ejecuta el promedio a unos 60 m de MC-01 (§19 dice Alex y §25 agenda a Tabata) y cómo se reintenta una descarga lenta (§24). DP-08 y DP-03 quedan como pendientes.
```

### P-INGESTA-03 · Planificar
- **Orden:** 15
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-02
- **Momento:** Antes del sábado 14
- **Produce:** specs/002-ingesta/plan.md, research.md, data-model.md
- **Herramientas:** skills `ingesta-nisar-asf`, `python-geoespacial`; MCP `context7`
- **Verificación:** stack de §18; COG sin pérdida; manifiesto con CQ-06

```text
[SDD P-INGESTA-03] /speckit-plan Usa asf_search y earthaccess para buscar y descargar, openSEPPO o GDAL 3.13 o superior para leer el GCOV desde la nube y recortar, h5py para las variables del GCOV y rasterio para escribir COG con DEFLATE o ZSTD y predictor en float32 (§18, §22). Reutiliza la base de specs/001-base-pipeline y su esquema de manifiesto. Las credenciales se leen de .netrc sin mostrarlas (RNF-06). Deja el tamaño del recorte configurable hasta que se resuelva DP-08. Consulta la documentación vigente con el MCP context7. Marca como hipótesis lo que el documento no fija.
```

### P-INGESTA-04 · Tareas
- **Orden:** 16
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-03
- **Momento:** Antes del sábado 14
- **Produce:** specs/002-ingesta/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** cada tarea con responsable, identificador y prueba, en el orden de §25

```text
[SDD P-INGESTA-04] /speckit-tasks Ordena por historia y en el orden de §25: primero búsqueda, descarga y recorte de San Ignacio (sábado 9:00–13:00); después huellas de escenas y focos FIRMS (14:00–20:00); después escenas VALIDATED (20:00–24:00). Cada tarea lleva su responsable según §19 (Alex) y las de MC-01 marcan quién la ejecuta según lo acordado (§19 y §25 difieren). Cada tarea cita su identificador y su prueba (PS-01, PS-02). Prueba antes que implementación; [P] en las paralelizables.
```

### P-INGESTA-05 · Analizar
- **Orden:** 17
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-04
- **Momento:** Antes del sábado 14
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagentes `guardian-alcance`, `revisor-cientifico`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-INGESTA-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/002-ingesta y pásalos por los subagentes guardian-alcance (alcance de §8, reglas de §16 y §22, pendientes de §29) y revisor-cientifico (RN-01, RN-02, MC-01). Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-INGESTA-06 · Implementar búsqueda, descarga y recorte
- **Orden:** 26
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-05, P-PROY-07
- **Momento:** Sáb 9:00–13:00
- **Produce:** COG por fecha en potencia lineal y datos del manifiesto (MC-01, CQ-06)
- **Herramientas:** skills `test-driven-development`, `ingesta-nisar-asf`, `flujo-issues-y-pr`; subagente `revisor-cientifico`
- **Verificación:** PS-01 y PS-02 en verde; primer par real disponible para la ciencia y la web

```text
[SDD P-INGESTA-06] /speckit-implement Implementa de specs/002-ingesta la búsqueda, la descarga y el recorte de San Ignacio con extracción de HHHH y HVHV a COG por fecha en potencia lineal, float32 y sin pérdida, y los datos del manifiesto (MC-01, CQ-06, RN-01, RN-02), una tarea a la vez y prueba primero (PS-01, PS-02). Es la base de la meta del sábado a las 13:00: entrega cuanto antes el primer par real a M-CIENCIA y M-PUBLICACIÓN. Crea el issue y la rama tipo/N desde dev (skill flujo-issues-y-pr); un commit por tarea con su identificador. Nunca muestres ni versiones las credenciales. Detente al terminar cada historia y muéstrame la evidencia.
```

### P-INGESTA-07 · Implementar huellas, focos FIRMS y escenas VALIDATED
- **Orden:** 34
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-06
- **Momento:** Sáb 14:00–20:00 huellas y focos · Sáb 20:00–24:00 escenas VALIDATED
- **Produce:** footprints.geojson (RF-26), focos FIRMS del periodo y tramo VALIDATED separado
- **Herramientas:** skills `test-driven-development`, `ingesta-nisar-asf`, `validacion-optica-firms`
- **Verificación:** huellas coinciden con el catálogo CMR; tramos separados por madurez

```text
[SDD P-INGESTA-07] /speckit-implement Implementa de specs/002-ingesta las huellas de las escenas usadas con órbita, dirección, fechas y polarizaciones, que coinciden con el catálogo CMR (RF-26), la obtención de los focos FIRMS del periodo para M-VALIDACIÓN y las escenas VALIDATED como tramo separado de PROVISIONAL (RN-02), usando para HV solo las órbitas con HH y HV (CQ-04). Prueba primero. Detente al terminar cada historia y muéstrame la evidencia.
```

### P-INGESTA-08 · Verificar
- **Orden:** 45
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Alex
- **Revisa:** Tabata
- **Depende de:** P-INGESTA-07
- **Momento:** Dom 14:00–19:00
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `revisor-cientifico`, `revisor-qa`, `devsecops-engineer`; `npm run codigo:revisar`
- **Verificación:** criterios con evidencia; revisión de Tabata

```text
[SDD P-INGESTA-08] /speckit-converge Compara el código con specs/002-ingesta y agrega como tareas lo que falte. Verifica con evidencia ejecutada MC-01, RF-26, RN-01, RN-02 y CQ-06: pytest (PS-01), integridad de los COG (PS-02), huellas frente al catálogo CMR, ninguna credencial versionada y revisor de código vivo (npm run codigo:revisar). Pide revisión a revisor-cientifico y revisor-qa, y la revisión humana de Tabata (revisora de M-INGESTA según §19). Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] Serie de San Ignacio de una sola órbita y grilla, en COG lineal float32 sin pérdida (MC-01, RNF-09).
- [ ] Manifiesto con gránulos, fechas, órbita, CRID y sumas de verificación (CQ-06).
- [ ] Huellas que coinciden con el catálogo CMR (RF-26); tramos PROVISIONAL y VALIDATED separados (RN-02).
- [ ] DP-08 resuelta por Alex y Tabata; discrepancia de MC-01 acordada.
- [ ] PS-01 y PS-02 en verde; revisado por Tabata; sin credenciales ni código muerto.
- [ ] PR a dev fusionada y el historial del SDD registrado.
