# Constitución de UraqiVision (backend)

Este repositorio es el **backend** de UraqiVision: el pipeline en Python (ingesta, ciencia, validación y
publicación de estaciones) y la función Insight. La web —globo, mapa, atlas e interfaz— vive en
[`UraqiVision`](https://github.com/marianZamorano/UraqiVision) y consume lo que este repositorio publica: los
archivos de cada estación (§17.3) y el contrato `POST /api/insight` (§21.1).

**El documento maestro manda.** `docs/UraqiVisionDocumentoMaestrov1.0.pdf` y su copia en texto son la fuente de
verdad (§1, §28). Esta constitución deriva de él y **nunca lo supera**: si una regla de aquí contradice el
documento, prevalece el documento, se corrige esta constitución y no al revés.

> **Estado: propuesta del equipo.** Redactada a partir del documento maestro; pendiente de aprobación por el
> equipo. Mientras no esté ratificada no se usa para cerrar discusiones que el documento ya resuelve ni para
> introducir requisitos nuevos.

## Core Principles

### I. Documento maestro primero

- Solo se implementa lo que está dentro del alcance del MVP (§8.1). Lo de §8.2 (procesamiento a pedido, alertas,
  InSAR, cuentas, bases de datos y colas) queda fuera.
- Las **decisiones pendientes DP-01 a DP-08** (§29) **no se implementan** hasta que se resuelvan y se registren.
  Una decisión tomada por el equipo se anota en el documento maestro; no se reabre sin pedirlo.
- No se inventan datos, cifras, fechas, fuentes, autores, DOI, endpoints ni capacidades de NISAR u otros satélites
  (§28). Lo que falta se declara como faltante.
- Toda afirmación se clasifica como **hecho verificado** (con fuente y fecha), **propuesta de diseño**,
  **hipótesis** o **pendiente**.
- Los documentos subordinados (esta constitución, las specs de `specs/`, la documentación de las herramientas)
  derivan del maestro; ante un conflicto se corrige el subordinado.

### II. Rigor científico

- **RN-01**: solo se comparan escenas de la **misma órbita** y la **misma grilla**.
- **RN-02**: sin productos **BETA**. Una sola madurez y un solo **CRID** por serie; PROVISIONAL y VALIDATED son
  tramos separados.
- **§12**: los promedios se calculan en potencia lineal y la conversión a **dB** se hace después; nunca al revés.
- **RN-05**: las causas del cambio son **hipótesis con fuente**, nunca certezas. Las clases de parche son cuatro:
  compatible con quema, compatible con pérdida previa de estructura, evidencia ambigua y datos insuficientes.
- **RN-06**: las hectáreas se informan siempre con su **rango de sensibilidad**.
- **RN-07**: las fechas son las de adquisición del satélite en **UTC**; se muestran en hora de Bolivia.
- **RN-08**: la madurez del producto (PROVISIONAL) se muestra en la página de método.
- **RN-13**: la ausencia de dato **nunca** se muestra como cero: aparece como «no reportada», con su motivo.
- Los métodos MC-01 a MC-09 y los controles CQ-01 a CQ-06 se aplican tal como están definidos; cualquier cambio de
  umbral o de método exige justificación y registro, no improvisación.

### III. Integridad y reproducibilidad

- **§22 y RNF-09**: los rásteres de análisis son **float32 sin pérdida** (COG con compresión sin pérdida). Ningún
  valor de análisis se altera al publicar; la comparación antes/después es una prueba obligatoria (PS-02).
- **RNF-08**: cada resultado se puede regenerar **desde el manifiesto y el notebook** reproducible. Si un resultado
  no se puede regenerar, no está terminado.
- **CQ-06**: no se publica una estación sin procedencia completa (escenas, órbita, CRID, madurez, fechas y
  verificaciones).
- **RN-04**: nunca se presentan datos simulados o de ejemplo como resultados. Los datos de prueba son sintéticos y
  se identifican como tales (PS-01).
- **RN-11**: los datos NISAR se citan según la guía de uso y citación de datos de la NASA.
- **RN-12**: ningún contenido generado con IA usa logos ni marcas de la NASA; las imágenes generadas con IA llevan
  marca de agua.

### IV. Arquitectura estática primero

- **§17**: todo el procesamiento pesado ocurre antes, en Python. El pipeline **publica archivos** (§17.3) y la web
  solo los lee. La **única pieza en un servidor** es la función Insight (§21).
- Cambiar el stack de §18, un formato de archivo publicado o el contrato de Insight es una decisión de equipo:
  se acuerda con la web y se registra en el documento maestro **antes** de implementarlo.
- Las reglas de visualización que condicionan los archivos publicados se respetan en su origen (§20.2): capas con
  leyenda, unidades, fuente y fecha; zonas sin dato con trama y explicadas; cifras con su rango.
- Lo que la web necesita de este repositorio se entrega como archivos y contratos versionados, no como lógica
  escondida en el pipeline.

### V. Seguridad y costo

- **RNF-06**: **ninguna** credencial de Earthdata (`.netrc`) ni clave del proveedor de IA entra al repositorio ni
  al navegador. Las claves viven solo en el servidor, por variables de entorno (PS-06).
- Solo existen `.env` local (nunca versionado) y `.env.example` (versionado, con las claves sensibles vacías).
- **RNF-10**: todo el stack funciona en **planes gratuitos**, salvo el consumo del proveedor de IA. No se activa
  nada que pueda generar cargos sin aprobación.
- **RNF-07**: Insight limita preguntas por sesión y longitud del texto; los límites se fijan en las pruebas
  (DP-04).
- El `.env`, el `.netrc` y las claves privadas no se leen ni se muestran.

### VI. Honestidad

- **RN-04**: nada simulado se presenta como resultado.
- **RN-10**: Insight **no** estima daños a personas, **no** pronostica y **no** recomienda acciones de emergencia.
- **RN-09 y RN-14**: Insight responde solo con el contenido publicado de la estación abierta, el método y el
  glosario; si se le pide confirmar una causa sin fuente, dice que no puede y explica por qué.
- Ningún texto publicado afirma una causa, una cifra o una fecha que el pipeline no pueda respaldar.

### VII. Trazabilidad

- Cada spec, tarea, prueba y commit cita sus identificadores (RF, RNF, MC, RN, CQ, VC, PS) y su **issue**.
- El flujo es **issue → rama `tipo/N-descripcion` desde `dev` → PR a `dev`**; `main`, `qa` y `dev` están
  protegidas y ninguna rama se salta pasos. Los commits siguen Conventional Commits y no llevan
  `Co-Authored-By` de asistentes de IA.
- Una tarea a la vez, con su prueba. No se da por terminado nada sin evidencia ejecutada en ese momento.
- No hay **código vivo**: nada roto, muerto o desconectado que parezca funcionar.

## Restricciones técnicas y de datos

- **Stack (§18)**: Python con asf_search y earthaccess; openSEPPO y GDAL 3.13 o superior; h5py; NumPy, xarray,
  rioxarray y SciPy; GeoPandas; rasterio; pandas; Matplotlib; **pytest**. scikit-learn solo para MC-09 (Plus).
  Insight es una función serverless con adaptador de proveedor (Claude por defecto, configurable).
- **Licencias (RNF-11)**: código **MIT**; textos y datos derivados **CC BY 4.0**, con sus archivos `LICENSE`.
- **Datos (§16)**: se respetan RN-01, RN-02, RN-04 a RN-07, RN-13 y RN-14 en todo el pipeline y en los archivos
  publicados.
- **Textos publicados**: todo lo que se publica para la web va en **español e inglés** (RNF-03); una estación sin
  sus dos idiomas no está completa (PS-03).
- **Equipo (§19)**: M-INGESTA (Alex), M-CIENCIA y M-VALIDACIÓN (Tabata), M-PUBLICACIÓN y M-INSIGHT (Mimi). Quien
  apoya el módulo de otra persona lo declara como apoyo y pide su revisión; no se apropia de la autoría.

## Flujo de desarrollo y calidad

1. **Spec-Driven Development** con Spec Kit: constitución → spec → aclarar → plan → tareas → analizar →
   implementar → verificar. Los prompts viven en `sdd/` y se ejecutan con la skill `sdd-prompts`.
2. **Pruebas (§23.3) antes de publicar**: PS-01 (unitarias de pytest con datos sintéticos), PS-02 (integridad de
   los COG), PS-03 (contenido completo en ambos idiomas) y PS-06 (ninguna clave en el bundle ni en el
   repositorio) son obligatorias para el backend. Las de interfaz, globo y recorrido (PS-04, PS-05, PS-07, PS-08,
   PS-09) corresponden a la web y se verifican allí.
3. **Controles científicos (CQ-01 a CQ-06) y validación (VC-01 a VC-05)** antes de publicar una estación; la
   validación usa dNBR de Sentinel-2 como referencia principal y focos FIRMS para fechar y clasificar.
4. **Guardas del repositorio**: las reglas de secretos, `.env`, `.netrc`, hooks, commits y PR son obligatorias y se
   comprueban con las herramientas del repositorio (`npm run ai:verificar`, `npm run test:guardas`). No se usa
   `--no-verify`, `--force` ni `git reset --hard`.
5. **Evidencia antes de afirmar**: no se dice que algo pasa o funciona sin haber ejecutado la verificación en ese
   momento, y se separan hechos, hipótesis y recomendaciones.

## Governance

- Esta constitución **está subordinada al documento maestro** (§1, §28). Ante cualquier conflicto, manda el
  documento.
- Las enmiendas se proponen al equipo, se justifican con identificadores del documento y se registran; no se
  cambian por conveniencia de una tarea.
- Toda PR de este repositorio verifica el cumplimiento de estos principios (alcance, identificadores, pruebas,
  licencias, secretos y documentos subordinados al día).
- Las decisiones pendientes DP-01 a DP-08 (§29) siguen su responsable y su fecha en el documento; esta
  constitución no las resuelve.
- La complejidad se justifica: lo que no esté en el MVP o no se pueda regenerar y probar, no entra.

**Version**: 1.0.0 (propuesta) | **Ratified**: pendiente de aprobación del equipo | **Last Amended**: 2026-11-14 (borrador para revisión)
