# Feature Specification: Ingesta de escenas NISAR de la estación San Ignacio de Velasco

**Feature Branch**: `docs/27-especificar-la-ingesta-nisar`
**Feature Directory**: `specs/002-ingesta`
**Created**: 2026-11-14
**Status**: Draft
**Módulo (§19)**: M-INGESTA, con Alex como responsable y Tabata como revisora
**Issue**: #27 · **Prompt SDD**: P-INGESTA-01
**Input**: prompt P-INGESTA-01 de `sdd/m-ingesta.md`, ejecutado tal cual.

> Fuente de verdad: `docs/UraqiVisionDocumentoMaestrov1.0.pdf`. Cada requisito conserva su identificador
> del documento. Lo que el documento no fija se marca como **propuesta**, y lo que depende de §29 como
> **pendiente (DP-xx)**.
>
> Constitución: esta spec se redactó sobre la **propuesta** de constitución de la rama
> `docs/25-constitucion-del-backend` (P-PROY-01, Mimi), todavía sin fusionar en `dev` ni ratificar. Si la
> constitución cambia al aprobarse, esta spec se revisa.

## Contexto verificado

Hechos del documento maestro (consulta al catálogo CMR del 12 de noviembre de 2026, §10.1 y §10.2):

- Producto: NISAR L2 GCOV. La serie principal es PROVISIONAL (CRID P05023, adquisiciones del 17 de junio al
  23 de octubre de 2026). VALIDATED (CRID P05036) empieza el 21 de octubre de 2026.
- Hueco permanente del instrumento entre el 27 de julio y el 10 de agosto de 2026.
- Sobre San Ignacio de Velasco hay 31 escenas PROVISIONAL en tres órbitas: 060A (10 fechas), 039D (9) y
  140D (8). Las polarizaciones son dobles (HH y HV) o solo HH, según la órbita y la fecha.
- VALIDATED sobre San Ignacio: 4 escenas de tres fechas; solo la órbita 161A tiene HH y HV.

Observaciones de una prueba de recorte de Alex del 14 de noviembre de 2026, hecha **fuera de este
repositorio**. No son resultados del pipeline: hay que reproducirlas dentro de él antes de citarlas.

- En la órbita 060A, de las 10 fechas, 9 tienen HH y HV y una (22 de septiembre) solo HH.
- El área de prueba cae en **dos frames** de la misma pasada, y cada uno viene en una zona UTM distinta.
- De las cuatro fechas anteriores al hueco, tres llegan con valores anómalos o vacíos (una entera en cero,
  con la máscara marcándola como no válida); las cinco posteriores al hueco son coherentes entre sí.
- La colección VALIDATED no tiene escenas de la órbita 060A sobre el área de prueba.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tener la serie recortada de San Ignacio lista para el análisis (Priority: P1)

Tabata (M-CIENCIA) necesita, por cada fecha de una órbita, los canales HH y HV del área de San Ignacio, en
potencia lineal y con los valores exactos del producto original, para calcular la línea base y el cambio.
Alex busca las escenas en el catálogo, obtiene solo el recorte del área y deja un archivo por fecha.

**Why this priority**: sin esta serie no hay antes/después real ni ningún cálculo posterior (§25, CU-06).

**Independent Test**: con el área y el periodo configurados, se obtiene la serie de una órbita y se comprueba
que cada archivo corresponde a una escena del catálogo, de la misma órbita, y que sus valores son idénticos a
los del original en el recorte.

**Acceptance Scenarios**:

1. **Given** el área de San Ignacio y el periodo de 2026, **When** se busca en el catálogo, **Then** se
   obtiene la lista de escenas con su fecha, órbita, dirección, polarizaciones, madurez y CRID.
2. **Given** una órbita elegida, **When** se prepara la serie, **Then** solo entran escenas de esa órbita y
   dirección, de una sola madurez y un solo CRID (RN-01, RN-02).
3. **Given** una escena de la serie, **When** se recorta, **Then** se guarda un archivo por fecha con HH y HV
   en potencia lineal, sin pérdida, y el original no se conserva (§22, RNF-09).
4. **Given** una fecha que solo tiene HH, **When** se prepara la serie, **Then** esa fecha no entra en la
   serie de HV y queda registrada como excluida, con su motivo (CQ-04).

---

### User Story 2 - Saber de dónde salió cada dato (Priority: P1)

Mimi (M-PUBLICACIÓN) y quien revise la estación necesitan la procedencia completa de cada dato usado, para
publicarla en el manifiesto y para que cualquiera pueda regenerar el resultado.

**Why this priority**: sin procedencia completa la estación no se publica (CQ-06).

**Independent Test**: se revisa el manifiesto de una serie y se comprueba que cada archivo recortado tiene su
gránulo, fecha, órbita, CRID y suma de verificación, y que repetir el proceso da los mismos archivos.

**Acceptance Scenarios**:

1. **Given** una serie recortada, **When** se abre el manifiesto, **Then** cada gránulo usado figura con su
   nombre, fecha, órbita, CRID y suma de verificación, junto con la versión del pipeline (§17.3, CQ-06).
2. **Given** un manifiesto existente, **When** se repite la ingesta, **Then** se obtienen los mismos
   archivos (RNF-08).

---

### User Story 3 - Mostrar qué observó NISAR sobre la estación (Priority: P2)

La web dibuja en el globo la cobertura de las escenas usadas. Necesita las huellas con su órbita, dirección,
fechas y polarizaciones.

**Why this priority**: es un requisito del MVP (RF-26), pero no bloquea el análisis.

**Independent Test**: se comparan las huellas producidas con los polígonos del catálogo para las mismas
escenas.

**Acceptance Scenarios**:

1. **Given** las escenas usadas en la estación, **When** se generan las huellas, **Then** cada una lleva su
   órbita, dirección, fechas y polarizaciones, y coincide con el polígono del catálogo (RF-26).

---

### User Story 4 - Entregar los focos de calor del periodo (Priority: P2)

Tabata (M-VALIDACIÓN) necesita los focos de calor FIRMS del periodo para fechar y clasificar los parches y
como contexto de la validación (§25, MC-04, VC-02).

**Why this priority**: lo agenda §25 para Alex el sábado por la tarde; lo consume otro módulo.

**Independent Test**: se obtienen los focos del periodo sobre el área y se comprueba que cada uno tiene
fecha y fuente.

**Acceptance Scenarios**:

1. **Given** el área y el periodo de la estación, **When** se obtienen los focos, **Then** cada foco tiene su
   posición, su fecha y su fuente.

---

### User Story 5 - Mantener el tramo VALIDATED aparte (Priority: P3)

El equipo quiere tener las escenas VALIDATED disponibles sin que se mezclen con la serie principal.

**Why this priority**: §25 lo agenda para el sábado por la noche; RN-02 exige que sea un tramo separado.

**Independent Test**: se obtiene el tramo VALIDATED y se comprueba que ningún archivo suyo figura en la serie
PROVISIONAL.

**Acceptance Scenarios**:

1. **Given** escenas VALIDATED sobre el área, **When** se ingieren, **Then** quedan en un tramo separado,
   identificado con su madurez y su CRID, y nunca en la serie principal (RN-02).

---

### Edge Cases

- Una fecha tiene solo HH: no entra en la serie de HV y se registra el motivo (CQ-04).
- El hueco del 27 de julio al 10 de agosto: se registra como hueco conocido, no como fallo de la ingesta.
- Una escena llega vacía o con zonas sin dato: lo ausente no se convierte en cero ni se rellena (RN-13).
- Una escena llega con valores fuera del rango físico: se entrega igual y se anota la observación; excluirla
  es una decisión de los controles de calidad (CQ-03), no de la ingesta.
- La misma adquisición aparece con más de una versión de procesamiento: solo puede entrar una, y la serie
  conserva un único CRID (RN-02).
- La huella de una escena toca el área pero su grilla no la cubre: se registra sin producir archivo.
- La descarga se interrumpe: al reanudar no quedan archivos a medias dados por válidos.
- El catálogo no devuelve escenas para la órbita pedida: se informa, sin crear una serie vacía.

## Requirements *(mandatory)*

### Functional Requirements

**Búsqueda y serie**

- **FR-001 (MC-01, §17.2)**: El sistema MUST buscar en el catálogo las escenas NISAR L2 GCOV por área,
  periodo y órbita, y registrar de cada una su gránulo, fecha y hora de adquisición, órbita, dirección,
  polarizaciones, madurez y CRID.
- **FR-002 (RN-02)**: El sistema MUST NOT usar productos BETA. La serie principal MUST tener una sola madurez
  y un solo CRID; PROVISIONAL y VALIDATED MUST quedar como tramos separados y nunca mezclarse.
- **FR-003 (RN-01, CQ-02)**: Una serie MUST contener solo escenas de la misma órbita y dirección, y MUST
  registrar la separación entre sus fechas.
- **FR-004 (CQ-04)**: El sistema MUST registrar qué polarizaciones tiene cada fecha. Una fecha sin HV MUST NOT
  entrar en la serie de HV y MUST quedar registrada como excluida, con su motivo.
- **FR-005 (RN-07)**: Las fechas MUST ser las de adquisición del satélite, en UTC.

**Recorte y archivos**

- **FR-006 (§22, §17.2)**: El sistema MUST obtener solo el recorte del área y los canales HH y HV, sin
  conservar los archivos originales.
- **FR-007 (§12, §22, RNF-09)**: Cada fecha MUST guardarse en potencia lineal, en coma flotante de 32 bits y
  con compresión sin pérdida, con valores idénticos a los del original. La conversión a dB no es parte de la
  ingesta.
- **FR-008 (§22, RN-01)**: El recorte MUST conservar la grilla del producto, sin remuestreo.
  [NEEDS CLARIFICATION: si el área cae en dos frames de la misma pasada y cada uno viene en una zona UTM
  distinta, ¿la ingesta entrega un archivo por frame o una sola grilla por fecha? Unirlos exige remuestrear
  uno de los dos.]
- **FR-009 (RN-13)**: La ausencia de dato MUST distinguirse de un valor medido y MUST NOT guardarse como cero.
- **FR-010 (MC-01, DP-03)**: El sistema MUST entregar junto a cada fecha la máscara del producto, sin
  interpretarla. Qué significa cada valor de la máscara está **pendiente (DP-03)**.
- **FR-011 (MC-01)**: La serie para el análisis se promedia en potencia lineal hasta unos 60 m.
  [NEEDS CLARIFICATION: §19 asigna MC-01 a M-INGESTA y §25 agenda «MC-01 y MC-02» para Tabata. ¿El promedio a
  unos 60 m lo entrega la ingesta o lo hace M-CIENCIA a partir de los recortes en resolución original?]
- **FR-012 (DP-08)**: El área de recorte MUST poder cambiarse sin modificar el código. Su valor (unos
  50 × 50 km, a fijar con los focos FIRMS de agosto en adelante) está **pendiente (DP-08)**.

**Procedencia**

- **FR-013 (CQ-06, §17.3, §22)**: El sistema MUST registrar, para cada gránulo usado, su nombre, fecha,
  órbita, CRID y suma de verificación, además de la versión del pipeline.
  [NEEDS CLARIFICATION: ¿la suma de verificación es la del gránulo original según el catálogo, la del recorte
  guardado, o ambas? §22 la pide para poder volver a descargar el mismo dato y los originales no se guardan.]
- **FR-014 (RNF-08)**: Repetir la ingesta a partir del manifiesto MUST producir los mismos archivos.
- **FR-015 (propuesta)**: Una ingesta interrumpida MUST poder reanudarse sin repetir lo ya obtenido y sin
  dejar archivos incompletos dados por válidos.

**Huellas, focos y tramo VALIDATED**

- **FR-016 (RF-26)**: El sistema MUST producir las huellas de las escenas usadas, con órbita, dirección,
  fechas y polarizaciones, y MUST coincidir con los polígonos del catálogo.
- **FR-017 (§25, MC-04, VC-02)**: El sistema MUST entregar los focos de calor FIRMS del periodo sobre el área,
  cada uno con su posición, su fecha y su fuente.
- **FR-018 (RN-02, §25)**: El sistema MUST poder ingerir el tramo VALIDATED y dejarlo separado de la serie
  principal, identificado con su madurez y su CRID.

**Seguridad y costo**

- **FR-019 (RNF-06)**: Las credenciales de Earthdata y las claves de otros servicios MUST NOT quedar en el
  repositorio, en los archivos producidos ni en los registros.
- **FR-020 (RNF-10)**: Toda la ingesta MUST funcionar con cuentas y servicios gratuitos.

### Key Entities *(include if feature involves data)*

- **Escena (gránulo)**: un archivo del catálogo; tiene fecha y hora de adquisición, órbita, dirección, frame,
  polarizaciones, madurez, CRID, huella y suma de verificación.
- **Serie**: conjunto de escenas de la misma órbita, dirección, madurez y CRID sobre el área, ordenadas por
  fecha, con sus fechas excluidas y el motivo de cada exclusión.
- **Recorte por fecha**: HH y HV de una escena dentro del área, en potencia lineal y sin pérdida, con su
  máscara.
- **Manifiesto**: registro de los gránulos usados y de la versión del pipeline (§17.3).
- **Huella**: polígono de cobertura de una escena, con órbita, dirección, fechas y polarizaciones (§17.3).
- **Foco de calor**: punto FIRMS con posición, fecha y fuente.
- **Área de recorte**: la zona de análisis de la estación; configurable y pendiente de DP-08.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (RN-01, RN-02)**: El 100 % de las escenas de una serie comparte órbita, dirección, madurez y CRID.
- **SC-002 (RNF-09, PS-02)**: En el 100 % de los píxeles comparados, el valor del recorte es idéntico al del
  producto original.
- **SC-003 (CQ-06)**: El 100 % de los gránulos usados figura en el manifiesto con todos sus campos; ningún
  campo queda vacío.
- **SC-004 (RF-26)**: El 100 % de las huellas coincide con el polígono del catálogo de su escena.
- **SC-005 (CQ-04)**: El 100 % de las fechas excluidas tiene un motivo registrado.
- **SC-006 (RNF-08)**: Repetir la ingesta desde el manifiesto produce archivos con las mismas sumas de
  verificación.
- **SC-007 (RNF-06, PS-06)**: Cero credenciales en el repositorio, en su historial y en los archivos
  producidos.
- **SC-008 (§25)**: El primer par de fechas, una anterior y otra posterior al hueco, está disponible para el
  mapa a la hora que fija §25 (sábado a las 13:00).

## Assumptions

- La base del pipeline (`specs/001-base-pipeline`, Tabata y Mimi) define la estructura del proyecto Python;
  esta spec no la decide.
- Alex tiene una cuenta gratuita de Earthdata y una clave gratuita de FIRMS, guardadas solo en su máquina.
- La descarga de Sentinel-2 y el dNBR (§25, domingo) pertenecen a `specs/004-validacion`, donde Alex apoya a
  Tabata; no forman parte de esta spec.
- Excluir una fecha por radiometría o por datos válidos es una decisión de los controles de calidad (CQ-03,
  CQ-05) de M-VALIDACIÓN; la ingesta entrega y anota.
- La elección de la órbita de la serie depende de qué fechas resulten utilizables antes y después del hueco;
  se acuerda con Tabata en las aclaraciones, porque condiciona la línea base (MC-02).
- El código de la prueba de recorte de Alex existe fuera del repositorio; se incorpora en la fase de
  implementación (P-INGESTA-06), no antes.
- Fuera de alcance: procesamiento a pedido de un área dibujada por el usuario (§8.2).

## Referencias (§31)

Referencias del documento maestro que respaldan esta spec (APA 7; consultadas por el equipo el 12 de noviembre
de 2026, según §31). Se citan también en el plan y en el código que implemente cada requisito.

- Alaska Satellite Facility. (2026). *NISAR data user guide*. <https://nisar-docs.asf.alaska.edu/>
  (MC-01, RF-26, RN-02, CQ-02, CQ-06).
- Alaska Satellite Facility. (2026). *Open source software packages*.
  <https://nisar-docs.asf.alaska.edu/using-open-source/> (MC-01, RNF-08).
- Alaska Satellite Facility. (2026). *Using NISAR data with GDAL*.
  <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal> (MC-01, RNF-09).
- GDAL/OGR contributors. (2026). *COG: Cloud Optimized GeoTIFF generator*.
  <https://gdal.org/drivers/raster/cog.html> (RNF-09, PS-02).

RF-26 también toca la referencia de CesiumJS, pero dibujar las huellas es trabajo de la web (`UraqiVision`);
aquí solo se producen, así que esa referencia se cita allí.
