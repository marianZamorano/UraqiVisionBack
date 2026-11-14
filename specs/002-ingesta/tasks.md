---
description: "Tareas de la ingesta de escenas NISAR (M-INGESTA)"
---

# Tasks: Ingesta de escenas NISAR de la estación San Ignacio de Velasco

**Input**: documentos de diseño de `specs/002-ingesta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/salidas-ingesta.md

**Módulo (§19)**: M-INGESTA · **Responsable de todas las tareas**: Alex · **Revisora**: Tabata ·
**Issue**: #29 · **Prompt SDD**: P-INGESTA-04

**Tests**: obligatorias. La prueba se escribe antes que la implementación y debe fallar primero (PS-01,
PS-02; constitución, principio VII).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes).
- **[US1]…[US5]**: historia de usuario de `spec.md`.
- Cada tarea cita su identificador del documento y, si tiene, su prueba.
- **Prueba previa**: qué cubre ya la prueba de descarga de Alex del 14 de noviembre, hecha fuera del
  repositorio (scripts `00` a `07`). Ese código es el punto de partida; entra tarea por tarea, con su prueba.

## Convenciones de rutas

Las de `plan.md`: `pipeline/src/uraqi/ingesta/` y `pipeline/tests/ingesta/`. Son una **hipótesis** hasta que
exista `specs/001-base-pipeline`; si esa spec fija otra estructura, se cambian las rutas, no las tareas.

## Estado de partida (prueba previa de Alex)

Comprobado el 14 de noviembre de 2026 contra `spec.md`. No son resultados del pipeline hasta reproducirlos
dentro del repositorio.

| Requisito | Qué hay | Qué falta |
|---|---|---|
| FR-001, FR-002 | Listado del catálogo; serie de la órbita 060A con un solo CRID (P05023), solo PROVISIONAL | Fechas excluidas con su motivo; separación entre fechas |
| FR-006 a FR-010 | 18 escenas (9 fechas × 2 frames) recortadas a COG `float32` en potencia lineal, un archivo por frame, con máscara | El recorte usa `h5py`, no GDAL ≥ 3.13 (research R2) |
| FR-011 | — | La pila promediada a unos 60 m |
| FR-013, FR-013a | Escena, fecha, órbita, dirección, frame, polarización, colección y CRID por escena | Suma del gránulo, suma de cada recorte y versión del pipeline |
| FR-015 | Tiempo límite y reintentos por escena; salta lo ya válido; escritura atómica | Registrar la escena no obtenida con su motivo |
| FR-016 | Huellas de todo el país (1 078), con órbita, dirección, fecha y polarización | Solo las escenas usadas, en `footprints.geojson` |
| FR-017 | Focos FIRMS del periodo sobre el área (1 134), con fecha y fuente | Verificar el formato del servicio |
| FR-018 | Búsqueda hecha: no hay escenas VALIDATED de la órbita 060A | Registrar el tramo como vacío, con su motivo |
| FR-019 | Credenciales fuera del repositorio | Pasar de variables de entorno a `.netrc` (research R8) |
| PS-01, PS-02 | — | Todas las pruebas |

---

## Fase 1: Preparación

**Propósito**: entorno y estructura. Depende de `specs/001-base-pipeline` (P-PROY-07).

- [ ] T001 Confirmar con la base del pipeline la estructura de carpetas, la versión de Python y el esquema del
  manifiesto; ajustar las rutas de este archivo si cambian (plan, research R12)
- [ ] T002 Comprobar que el entorno trae GDAL ≥ 3.13 con el driver COG. Si no, detenerse y acordar con el
  equipo el respaldo con `h5py` antes de seguir (§18, research R2). Prueba previa: resolvió GDAL 3.12.3
- [ ] T003 [P] Crear `pipeline/config/san_ignacio.yaml` con área, periodo, hueco, órbita 060 ascendente,
  colecciones y capas; el área queda marcada como pendiente de DP-08 (FR-002a, FR-012). Prueba previa: existe
  un archivo equivalente
- [ ] T004 [P] Avisar al equipo de que la clave de FIRMS agrega una variable al entorno, antes de tocar
  `.env.example` (RNF-06, research R8)

---

## Fase 2: Base común (bloquea todas las historias)

- [ ] T005 Prueba de `config.py` en `pipeline/tests/ingesta/test_config.py`: rechaza una configuración sin
  área, sin órbita o con una colección BETA (FR-002, FR-012; PS-01)
- [ ] T006 Implementar `pipeline/src/uraqi/ingesta/config.py`: leer y validar la configuración (FR-002a,
  FR-012)
- [ ] T007 [P] Prueba de escritura atómica y de reintentos en `pipeline/tests/ingesta/test_descarga.py`: un
  fallo simulado no deja un archivo con su nombre definitivo; se respeta el número de reintentos (FR-015;
  PS-01)
- [ ] T008 [P] Implementar las utilidades de reintento y de escritura atómica en
  `pipeline/src/uraqi/ingesta/descarga.py` (FR-015, §24). Prueba previa: lógica equivalente ya probada

**Punto de control**: configuración y utilidades listas.

---

## Fase 3: Historia 1 · Serie recortada de San Ignacio (P1) 🎯 MVP — sábado 9:00–13:00

**Objetivo**: un archivo por fecha y por frame con HH, HV y máscara, en potencia lineal y sin pérdida.

**Prueba independiente**: cada archivo corresponde a una escena del catálogo de la órbita 060A, y sus valores
son idénticos a los del original en el recorte.

### Pruebas (primero; deben fallar)

- [ ] T009 [P] [US1] `test_serie.py`: con escenas sintéticas, la serie solo admite una órbita, una dirección,
  una madurez y un CRID; rechaza BETA; registra la separación entre fechas (RN-01, RN-02, CQ-02; PS-01)
- [ ] T010 [P] [US1] `test_serie.py`: una fecha con solo HH queda excluida de la serie de HV, con su motivo; si
  una adquisición tiene dos versiones de procesamiento, entra una sola (CQ-04, RN-02; PS-01)
- [ ] T011 [P] [US1] `test_recorte.py`: la ventana cae en píxeles enteros de la grilla y no cambia el CRS ni la
  resolución; una huella que toca el área sin que la grilla la cubra da `sin_solape` (FR-008, CQ-01; PS-01)
- [ ] T012 [P] [US1] `test_cog.py`: un ráster sintético `float32` escrito como COG se lee con valores
  idénticos; el sin dato es `NaN` y nunca cero; la máscara conserva su tipo (RNF-09, RN-13; PS-02)

### Implementación

- [ ] T013 [US1] `catalogo.py`: buscar en CMR por colección, área y periodo; devolver por escena gránulo,
  adquisición en UTC, órbita, dirección, frame, polarizaciones, madurez, CRID y huella (FR-001, FR-005). Prueba
  previa: cubierto con `earthaccess`
- [ ] T014 [US1] `serie.py`: aplicar las reglas de T009 y T010 y elegir el frame principal por cobertura del
  área (FR-002, FR-003, FR-004, FR-008). Prueba previa: filtra por órbita y versión, sin registrar motivos
- [ ] T015 [US1] `recorte.py`: calcular la ventana del área sobre la grilla del producto y leer desde la nube
  solo HH, HV y máscara, con GDAL ≥ 3.13 por `/vsicurl/` y credenciales de `.netrc` (FR-006, FR-008, FR-010,
  RNF-06). Prueba previa: misma ventana leída con `h5py`
- [ ] T016 [US1] `cog.py`: escribir cada capa como COG sin pérdida, con sus etiquetas de escena, capa, madurez
  y CRID (FR-007, FR-009). Prueba previa: cubierto
- [ ] T017 [US1] `cli.py`: comandos `listar` y `recortar`, con tiempo límite y reintentos por escena, que
  saltan lo ya válido y registran cada escena no obtenida con su motivo (FR-015)
- [ ] T018 [US1] Obtener el primer par, una fecha anterior y otra posterior al hueco, y avisar a Joaco y a
  Tabata de que está disponible (§25, SC-008). Prueba previa: las 9 fechas ya están descargadas fuera del
  repositorio; hay que reproducirlas con el pipeline
- [ ] T019 [US1] Obtener la serie completa de la órbita 060A y anotar las observaciones de cada escena (todo
  en cero, valores fuera de rango) sin excluirla (FR-009; CQ-03 la decide M-VALIDACIÓN)

**Punto de control**: Tabata puede empezar MC-02 con los recortes.

---

## Fase 4: Historia 2 · Procedencia (P1) — sábado 9:00–13:00

**Objetivo**: los datos que el manifiesto necesita (CQ-06).

### Pruebas (primero)

- [ ] T020 [P] [US2] `test_procedencia.py`: cada escena usada tiene gránulo, fecha, órbita, CRID, suma del
  gránulo, suma de cada recorte y versión del pipeline, sin campos vacíos; una suma ausente figura como «no
  reportada», con su motivo (CQ-06, RN-13; PS-01)
- [ ] T021 [P] [US2] `test_cog.py`: escribir dos veces el mismo ráster da la misma suma SHA-256 (RNF-08; PS-02)

### Implementación

- [ ] T022 [US2] `catalogo.py`: leer la suma MD5 del gránulo que publica CMR (FR-013, research R5)
- [ ] T023 [US2] `cog.py`: calcular la SHA-256 de cada archivo guardado (FR-013a)
- [ ] T024 [US2] `procedencia.py`: escribir los datos de procedencia de la serie, con la versión del pipeline
  (FR-013, §17.3). Prueba previa: registra todo salvo las sumas y la versión
- [ ] T025 [US2] Repetir la ingesta de una fecha y comprobar que las sumas coinciden (FR-014, SC-006)

---

## Fase 5: Promedio a unos 60 m (MC-01) — ⚠ pendiente de la confirmación de Tabata

**Quién la ejecuta**: Alex, según §19 y la aclaración del 14 de noviembre. §25 agenda MC-01 a Tabata. **No se
empieza hasta que Tabata lo confirme**; si prefiere hacerlo ella, estas tareas pasan a `specs/003-ciencia`.

- [ ] T026 [P] [US1] `test_promedio.py`: el promedio por bloques se calcula en potencia lineal (no en dB),
  ignora los `NaN`, da `NaN` en un bloque sin datos y devuelve la fracción de píxeles válidos (MC-01, §12,
  RN-13; PS-01)
- [ ] T027 [US1] `promedio.py`: pila de la serie a unos 60 m con su máscara de datos válidos, solo del frame
  principal; el tamaño del bloque es un parámetro (FR-011)
- [ ] T028 [US1] `cli.py`: comando `promediar` y entrega de la pila a Tabata

---

## Fase 6: Historia 3 · Huellas (P2) — sábado 14:00–20:00

### Pruebas (primero)

- [ ] T029 [P] [US3] `test_huellas.py`: cada elemento conserva la geometría de entrada sin modificarla y lleva
  órbita, dirección, fechas y polarizaciones; solo entran las escenas usadas (RF-26; PS-01)

### Implementación

- [ ] T030 [US3] `huellas.py` y comando `huellas`: escribir `footprints.geojson` con las escenas usadas
  (FR-016, §17.3). Prueba previa: genera las huellas de todo el país; hay que filtrarlas
- [ ] T031 [US3] Comparar cada huella con el polígono del catálogo de su escena (SC-004)

---

## Fase 7: Historia 4 · Focos FIRMS (P2) — sábado 14:00–20:00

### Pruebas (primero)

- [ ] T032 [P] [US4] `test_firms.py`: con una respuesta sintética, cada foco conserva posición, fecha y hora en
  UTC, fuente y confianza; los duplicados entre tramos no se cuentan dos veces (FR-017; PS-01)

### Implementación

- [ ] T033 [US4] `firms.py` y comando `focos`: focos del periodo sobre el área, por tramos, con la clave leída
  del entorno y nunca escrita (FR-017, RNF-06). Prueba previa: cubierto; verificar el formato del servicio
- [ ] T034 [US4] Entregar los focos a Tabata para fechar y clasificar los parches (MC-04, VC-02)

---

## Fase 8: Historia 5 · Tramo VALIDATED (P3) — sábado 20:00–24:00

### Pruebas (primero)

- [ ] T035 [P] [US5] `test_serie.py`: una escena VALIDATED nunca entra en la serie PROVISIONAL y su tramo lleva
  su propia madurez y su CRID (RN-02; PS-01)

### Implementación

- [ ] T036 [US5] Comando `recortar` para la colección VALIDATED, con carpeta y serie aparte (FR-018)
- [ ] T037 [US5] Si no hay escenas VALIDATED de la órbita de la serie, registrar el tramo como vacío, con su
  motivo, sin crear una serie vacía (RN-13). Prueba previa: no las hay para la órbita 060A

---

## Fase 9: Cierre

- [ ] T038 [P] Buscar credenciales en el repositorio, en su historial y en las salidas; el resultado debe ser
  cero (RNF-06, SC-007, PS-06)
- [ ] T039 [P] Citar las referencias de §31 en el código de recorte y de escritura (research, referencias)
- [ ] T040 Recorrer `quickstart.md` de principio a fin y anotar el resultado de cada paso
- [ ] T041 Ejecutar `npm run codigo:revisar`: nada roto, muerto ni desconectado (constitución, principio VII)
- [ ] T042 Pedir la revisión de Tabata (revisora de M-INGESTA, §19)

---

## Dependencias y orden

- **Fase 1** depende de `specs/001-base-pipeline` (Tabata y Mimi). T002 bloquea T015.
- **Fase 2** bloquea todas las historias.
- **Fase 3 (US1)** es el MVP y va primero. T009 a T012 antes que T013 a T016; T017 depende de T013 a T016;
  T018 y T019 dependen de T017.
- **Fase 4 (US2)** se apoya en `catalogo.py` y `cog.py` de la fase 3.
- **Fase 5** espera la confirmación de Tabata; técnicamente solo necesita los recortes de la fase 3.
- **Fases 6 y 7** son independientes entre sí y pueden ir en paralelo tras la fase 3.
- **Fase 8** depende de `serie.py` y `recorte.py`.
- DP-08: T019 se repite si el área cambia. DP-03: no bloquea ninguna tarea.

## Tareas en paralelo

- Fase 1: T003 y T004.
- Fase 3: T009, T010, T011 y T012 (pruebas en archivos distintos).
- Tras la fase 3: T029 y T032, y con ellas T020 y T021.

## Estrategia

1. Fases 1 y 2.
2. Fase 3 hasta T018: el primer par para el mapa (§25).
3. Fase 4, para que nada se publique sin procedencia (CQ-06).
4. Fases 6 y 7 por la tarde; fase 8 por la noche; fase 5 cuando Tabata confirme.
5. Fase 9 antes de la PR de implementación.
