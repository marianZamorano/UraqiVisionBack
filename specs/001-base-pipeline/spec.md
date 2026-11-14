# Feature Specification: Base del pipeline (001-base-pipeline)

**Feature Branch**: `001-base-pipeline`
**Status**: Draft (P-PROY-02, issue #62). Ejecutan Tabata y Mimi; revisa Alex.
**Fuentes**: documento maestro v1.1 (§8, §18, §22, §23.3, §28); RNF-06, RNF-08, RNF-10, RNF-11, CQ-06, PS-01.
**Módulo (§19)**: Herramientas del repositorio (base común de todos los módulos).

## Contexto

Todas las áreas del pipeline (ingesta, ciencia, validación, publicación) y la función Insight dependen de una base
común: un entorno Python que se instala desde cero con versiones fijadas, pruebas con datos sintéticos, un notebook
reproducible, un manifiesto de procedencia y las licencias del repositorio.

**Fuera de alcance**: los métodos de cada área (los especifican sus SDD) y lo de §8.2 (procesamiento a pedido,
alertas, InSAR, cuentas, bases de datos y colas).

## User Scenarios & Testing

### User Story 1 - Instalar el entorno desde cero (Priority: P1)

Quien llega al repositorio instala el entorno con versiones fijadas y todo funciona en planes gratuitos.

**Independent Test**: en un entorno limpio, la instalación termina sin pasos manuales ocultos.

**Acceptance Scenarios**:

1. **Given** un entorno limpio, **When** se instala según la documentación del repositorio, **Then** las versiones quedan fijadas (RNF-10 y §18).
2. **Given** el entorno instalado, **When** se revisan los servicios usados, **Then** son gratuitos (RNF-10).

### User Story 2 - Pruebas con datos sintéticos (Priority: P1)

Quien desarrolla ejecuta las pruebas sin descargar datos reales.

**Independent Test**: `pytest` corre en verde con datos sintéticos (PS-01).

**Acceptance Scenarios**:

1. **Given** el entorno instalado, **When** se ejecuta `pytest`, **Then** las pruebas pasan sin red ni credenciales (PS-01).
2. **Given** una prueba que necesitaría un dato real, **When** se escribe, **Then** usa un dato sintético y se identifica como tal (RN-04).

### User Story 3 - Reproducir un resultado y conocer su procedencia (Priority: P2)

Quien revisa un resultado puede regenerarlo desde el manifiesto y el notebook.

**Independent Test**: el manifiesto lista gránulos, CRID, sumas de verificación y versión del pipeline (CQ-06).

**Acceptance Scenarios**:

1. **Given** un resultado, **When** se busca su procedencia, **Then** el manifiesto la lista completa (CQ-06).
2. **Given** el notebook reproducible, **When** se ejecuta desde el manifiesto, **Then** regenera el resultado (RNF-08).

### User Story 4 - Licencias y secretos (Priority: P1)

El repositorio declara sus licencias y ninguna credencial se versiona.

**Acceptance Scenarios**:

1. **Given** el repositorio, **When** se revisa, **Then** el código tiene licencia MIT y los textos y datos derivados CC BY 4.0 (RNF-11).
2. **Given** el repositorio y su historial, **When** se busca una credencial, **Then** no aparece (RNF-06, PS-06).

## Requirements

### Functional Requirements

- **FR-001**: Un entorno Python instalable desde cero, con versiones fijadas (§18, RNF-10).
- **FR-002**: Un espacio para cada área (ingesta, ciencia, validación, publicación, Insight) (§19).
- **FR-003**: Pruebas con datos sintéticos ejecutables con `pytest` (PS-01).
- **FR-004**: Un notebook reproducible que regenera cada resultado desde el manifiesto (RNF-08).
- **FR-005**: Un manifiesto con gránulos, CRID, sumas de verificación y versión del pipeline (CQ-06).
- **FR-006**: Licencia MIT para el código y CC BY 4.0 para textos y datos derivados (RNF-11).
- **FR-007**: Ningún secreto en el repositorio: `.env` y `.netrc` fuera del control de versiones (RNF-06, PS-06).
- **FR-008**: Solo servicios gratuitos para el entorno (RNF-10).

### Key Entities

- **Entorno**: instalación reproducible con versiones fijadas.
- **Manifiesto**: registro de procedencia de un resultado.
- **Notebook reproducible**: regenera resultados desde el manifiesto.

## Success Criteria

- **SC-001**: La instalación desde cero termina sin pasos manuales ocultos.
- **SC-002**: `pytest` pasa sin red ni credenciales.
- **SC-003**: El repositorio no contiene secretos (PS-06).
- **SC-004**: Las licencias están presentes para código y textos.

## Aclaraciones pendientes

- [NEEDS CLARIFICATION: versiones exactas de §18 que se fijan; se verifican contra la documentación vigente antes de fijarlas (plan, P-PROY-03).]
- [NEEDS CLARIFICATION: forma del notebook reproducible: qué se regenera primero (decide Tabata con Alex).]

## Assumptions

- La base no implementa métodos científicos: eso es de cada SDD de área.
- Los datos reales de NISAR se descargan fuera de esta base (M-INGESTA) y nunca se versionan.
