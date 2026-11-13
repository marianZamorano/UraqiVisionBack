---
id: PROYECTO
titulo: Constitución, entorno Python, repositorio y licencias
tipo: proyecto
prefijo: PROY
spec: specs/001-base-pipeline
---

# SDD · PROYECTO — Constitución, entorno Python, repositorio y licencias

Primer SDD del backend: la constitución de Spec Kit y el proyecto Python vacío pero completo (paquetes por área,
dependencias fijadas, pruebas, notebook reproducible y licencias) sobre el que trabajan todas las áreas.

## 1. Ficha

| Campo | Valor |
|---|---|
| Repositorio | `UraqiVisionBack` (backend) |
| Constitución | Equipo (no tiene responsable en §19: la redacta quien el equipo acuerde y la revisan todos) |
| Entorno Python | Tabata, según §25 («Antes: entorno Python») |
| Repositorio y licencias | Mimi, según §25 («Antes: repositorio y licencias») |
| Revisión | Alex (base del pipeline) · todo el equipo (constitución) |
| Spec | `specs/001-base-pipeline` |
| Momento (§25) | Antes del sábado 14, si las reglas 2026 lo permiten (DP-02) |

## 2. Alcance del documento maestro

- Arquitectura estática primero (§17): todo el procesamiento pesado ocurre antes, en Python; la única pieza en un
  servidor es la función Insight.
- Stack de §18: asf_search y earthaccess; openSEPPO y GDAL 3.13 o superior; h5py; NumPy, xarray, rioxarray y SciPy;
  GeoPandas; rasterio; pandas; Matplotlib; pytest. scikit-learn solo para MC-09 (Plus). Insight como función
  serverless con adaptador de proveedor.
- Base transversal: RNF-06 (ninguna credencial en el repositorio), RNF-08 (reproducibilidad desde el manifiesto y
  el notebook), RNF-09 (integridad de los rásteres), RNF-10 (planes gratuitos), RNF-11 (código MIT, textos y datos
  derivados CC BY 4.0).
- Fuera del MVP (§8.2): procesamiento a pedido, alertas, InSAR, cuentas, bases de datos y colas.

## 3. Reglas y decisiones que aplican

- Reglas del pipeline de §16: RN-01 (misma órbita y grilla), RN-02 (sin productos BETA), RN-13 (sin dato nunca es
  cero); promedios en potencia lineal y conversión a dB después (§12); almacenamiento sin pérdida (§22).
- §28: no inventar datos, cifras, fuentes ni capacidades de NISAR.
- Pendientes que no se deciden aquí: DP-03, DP-05 y DP-08 (ciencia e ingesta), DP-04 y DP-06 (Insight y
  hospedaje), DP-02 (guías 2026).

## 4. Contratos e integración

- **Entrega a las áreas**: paquetes `ingesta`, `ciencia`, `validacion`, `publicacion` e `insight` (propuesta de
  diseño), configuración de pruebas con datos sintéticos (PS-01), esqueleto del notebook reproducible y del
  manifiesto (RNF-08, CQ-06).
- **Contratos con la web**: archivos publicados de §17.3 y `POST /api/insight` de §21.1 (los definen
  M-PUBLICACIÓN y M-INSIGHT; aquí solo se reserva su lugar).

## 5. Calidad: pruebas y aceptación

- PS-01 (pytest con datos sintéticos) configurado y en verde; PS-06 (ninguna clave ni credencial en el repositorio).
- El entorno se instala desde cero con las versiones fijadas y el revisor de código vivo no encuentra código muerto
  (`npm run codigo:revisar`).

## 6. Herramientas del repositorio

- Skills: `documento-maestro`, `sdd-uraqivision`, `sdd-prompts`, `python-geoespacial`, `notebook-reproducible`,
  `test-driven-development`, `devops-secrets-management`, `devops-dependency-security`.
- Subagentes: `guardian-alcance`, `revisor-qa`, `devsecops-engineer`.
- MCP: `context7` (versiones y APIs vigentes de las librerías de §18).
- Hooks: guardas de secretos, `.env` y `.netrc` (RNF-06), pre-commit, código vivo.

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
- **Cesium GS (2026). CesiumJS [Software]** — <https://github.com/CesiumGS/cesium>
  Citada en: §18. Aplica a: RF-02, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-32, RF-24, RNF-11. Usa la documentación vigente (MCP context7) al implementar el globo; muestra su atribución y licencia en el globo y en Acerca de (RF-24, RNF-11).
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).

<!-- referencias:fin -->

## 7. Riesgos y pendientes

- §24: «Una sola persona procesa los datos» → una estación con un solo recorte; RXD y el clasificador quedan como
  Plus.
- DP-02: si las reglas 2026 no permiten trabajo previo, estos prompts pasan al sábado a las 9:00.
- Las credenciales de Earthdata viven en `.netrc` local; nunca se leen ni se versionan.

## 8. Secuencia de prompts

### P-PROY-01 · Constitución
- **Orden:** 1
- **Fase:** 1 · Constitución
- **Comando:** speckit-constitution
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** —
- **Momento:** Antes del sábado 14
- **Produce:** .specify/memory/constitution.md
- **Herramientas:** skills `documento-maestro`, `sdd-uraqivision`; subagente `guardian-alcance`
- **Verificación:** la constitución no tiene marcadores de plantilla y cita §8, §12, §16, §17, §22 y §28

```text
[SDD P-PROY-01] /speckit-constitution Crea la constitución del backend de UraqiVision a partir de docs/UraqiVisionDocumentoMaestrov1.0.pdf (lee la copia .txt), que es la fuente de verdad y prevalece sobre la constitución. Este repositorio es el pipeline en Python (ingesta, ciencia, validación y publicación de estaciones) y la función Insight; la web vive en UraqiVision. Principios: I. Documento maestro primero: nada fuera del alcance de §8 sin consultar; las decisiones pendientes DP-01 a DP-08 de §29 no se implementan hasta resolverse. II. Rigor científico: misma órbita y grilla (RN-01), sin productos BETA y una sola madurez y CRID por serie (RN-02), promedios en potencia lineal y conversión a dB después (§12), causas como hipótesis con fuente (RN-05), hectáreas con rango (RN-06), la ausencia de dato nunca es cero (RN-13). III. Integridad y reproducibilidad: compresión sin pérdida y ningún valor de análisis alterado (§22, RNF-09); cada resultado se regenera desde el manifiesto y el notebook (RNF-08); no se publica sin procedencia completa (CQ-06). IV. Arquitectura estática primero (§17): el pipeline publica archivos (§17.3) y la única pieza en un servidor es Insight (§21); cambiar el stack de §18 o un contrato requiere acordarlo con la web y registrarlo en el documento. V. Seguridad y costo: ninguna credencial de Earthdata ni clave del proveedor de IA en el repositorio (RNF-06); planes gratuitos (RNF-10); Insight limitado (RNF-07). VI. Honestidad: nada simulado como resultado (RN-04); Insight no pronostica ni estima daños (RN-10). VII. Trazabilidad: cada spec, tarea, prueba y commit cita sus identificadores (MC, CQ, VC, RF, RNF, RN, PS) y su issue. Restricciones: Python con pytest, código MIT y textos y datos derivados CC BY 4.0 (RNF-11). Flujo: issue → rama tipo/N desde dev → PR a dev; una tarea a la vez con su prueba; commits sin Co-Authored-By de IA; código vivo (nada desconectado ni muerto).
```

### P-PROY-02 · Especificar la base del pipeline
- **Orden:** 2
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14 (entorno Python; repositorio y licencias)
- **Produce:** specs/001-base-pipeline/spec.md
- **Herramientas:** skills `documento-maestro`, `python-geoespacial`, `notebook-reproducible`
- **Verificación:** cada requisito conserva su identificador; sin librerías en la spec

```text
[SDD P-PROY-02] /speckit-specify Feature 001-base-pipeline (número 001, nombre corto base-pipeline) del backend de UraqiVision: la base sobre la que trabajan todas las áreas del pipeline e Insight. El equipo debe poder instalar el entorno desde cero con versiones fijadas y ejecutar las pruebas con datos sintéticos (PS-01); cada área (ingesta, ciencia, validación, publicación e Insight) tiene su lugar; existe un notebook reproducible que regenerará cada resultado desde el manifiesto (RNF-08) y un manifiesto con gránulos, CRID, sumas de verificación y versión del pipeline (CQ-06); el repositorio declara licencias MIT para el código y CC BY 4.0 para textos y datos derivados (RNF-11); ninguna credencial de Earthdata ni clave de IA se versiona (RNF-06); todo funciona en planes gratuitos (RNF-10). Fuera de alcance: los métodos de cada área (los especifican sus SDD) y lo de §8.2.
```

### P-PROY-03 · Planificar la base del pipeline
- **Orden:** 3
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-02
- **Momento:** Antes del sábado 14
- **Produce:** specs/001-base-pipeline/plan.md, research.md, data-model.md
- **Herramientas:** skills `python-geoespacial`, `notebook-reproducible`, `devops-dependency-security`; MCP `context7`
- **Verificación:** el plan usa solo el stack de §18 con versiones fijadas

```text
[SDD P-PROY-03] /speckit-plan Usa el stack fijado en §18 del documento maestro, con versiones fijadas: asf_search, earthaccess, GDAL 3.13 o superior (y openSEPPO), h5py, NumPy, xarray, rioxarray, SciPy, GeoPandas, rasterio, pandas, Matplotlib y pytest; scikit-learn solo si se llega a MC-09 (Plus). Un paquete por área (ingesta, ciencia, validacion, publicacion, insight) y datos sintéticos para las pruebas. Esquema del manifiesto (CQ-06) y esqueleto del notebook (RNF-08). Licencias MIT y CC BY 4.0 (RNF-11). Credenciales solo en .netrc y .env locales, con .env.example sin valores (RNF-06). Consulta las versiones vigentes con el MCP context7 y revisa la seguridad de las dependencias (skill devops-dependency-security). Marca como propuesta o hipótesis lo que el documento no fija.
```

### P-PROY-04 · Tareas de la base del pipeline
- **Orden:** 4
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-03
- **Momento:** Antes del sábado 14
- **Produce:** specs/001-base-pipeline/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** cada tarea con responsable (Tabata: entorno; Mimi: repositorio y licencias), identificador y prueba

```text
[SDD P-PROY-04] /speckit-tasks Ordena por historia de usuario. Las tareas del entorno Python son de Tabata y las de repositorio y licencias de Mimi, como agenda §25. Cada tarea cita su identificador (RNF-06, RNF-08, RNF-11, CQ-06) y su prueba (PS-01, PS-06). Prueba antes que implementación; [P] en las paralelizables. Incluye una tarea que instale el entorno desde cero y ejecute las pruebas.
```

### P-PROY-05 · Analizar la base del pipeline
- **Orden:** 5
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-04
- **Momento:** Antes del sábado 14
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagente `guardian-alcance`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-PROY-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/001-base-pipeline y pásalos por el subagente guardian-alcance (alcance de §8, reglas de §16, §22 y §28, pendientes de §29). Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-PROY-06 · Implementar la base del pipeline
- **Orden:** 6
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-05
- **Momento:** Antes del sábado 14, o sábado 9:00 si DP-02 no lo permite
- **Produce:** proyecto Python base con pruebas en verde
- **Herramientas:** skills `test-driven-development`, `flujo-issues-y-pr`, `devops-secrets-management`; hooks de git
- **Verificación:** pytest en verde; entorno instalable desde cero; sin credenciales versionadas

```text
[SDD P-PROY-06] /speckit-implement Implementa specs/001-base-pipeline una tarea a la vez, prueba primero (skill test-driven-development). Antes de empezar crea el issue de la feature y su rama tipo/N desde dev (skill flujo-issues-y-pr); un commit por tarea citando su identificador y el issue. Ninguna credencial en el repositorio: .netrc y .env solo locales y el .env.example sin valores (si cambia su estructura, avisa al equipo). Detente al terminar cada historia y muéstrame la evidencia (salida de pytest).
```

### P-PROY-07 · Verificar la base del pipeline
- **Orden:** 7
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Tabata, Mimi
- **Revisa:** Alex
- **Depende de:** P-PROY-06
- **Momento:** Antes del sábado 14
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `revisor-qa`, `devsecops-engineer`; `npm run codigo:revisar`
- **Verificación:** cada criterio con evidencia; sin código muerto; PR a dev fusionada

```text
[SDD P-PROY-07] /speckit-converge Compara el código con specs/001-base-pipeline y agrega como tareas lo que falte. Después verifica cada criterio de aceptación con evidencia ejecutada: instalación desde cero, pytest (PS-01), ninguna credencial ni clave en el repositorio (PS-06), licencias presentes (RNF-11) y revisor de código vivo (npm run codigo:revisar). Pide revisión a los subagentes revisor-qa y devsecops-engineer y la revisión humana de Alex. Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] Constitución sin marcadores de plantilla, aprobada por el equipo.
- [ ] Entorno instalable desde cero con versiones fijadas; pytest en verde con datos sintéticos.
- [ ] Esqueleto del notebook reproducible y del manifiesto; licencias MIT y CC BY 4.0.
- [ ] Ninguna credencial ni clave versionada; `npm run codigo:revisar` sin errores.
- [ ] PR a dev fusionada y el historial del SDD registrado.
