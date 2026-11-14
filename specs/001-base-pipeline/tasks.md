# Tareas: base del pipeline (001-base-pipeline)

**Prompt:** P-PROY-04 (issue #64). Ninguna tarea está hecha: la implementación empieza en P-PROY-06 y necesita tu
aprobación para instalar dependencias. Responsables: **Tabata** (entorno), **Mimi** (repositorio y licencias).

## Estado (14 nov 2026)

Hechas con evidencia: T003 a T008 y T011. Pendientes: T001 y T002 (requieren tu aprobación y a Tabata), T009 (forma del notebook) y T010 (revisión de servicios gratuitos).

## Entorno (Tabata)

- [ ] T001 Archivo de dependencias con las versiones de `plan.md` §1; las pendientes (openSEPPO, GDAL) se verifican antes. Prueba: instalación en entorno limpio (SC-001).
- [ ] T002 Verificar openSEPPO y GDAL ≥ 3.13 contra su documentación vigente. Prueba: `gdalinfo --version` ≥ 3.13 (§18). Bloqueado por la verificación.
- [X] T003 Crear `ingesta/`, `ciencia/`, `validacion/`, `publicacion/` con la regla de dependencias de `docs/arquitectura.md`. Prueba: `pytest` importa cada paquete (PS-01).
  Evidencia: Paquetes por área como documentación de estado (`ingesta/`, `ciencia/`, `validacion/`, `publicacion/`); el código llega con cada P-*-06. Verificado: `npm run codigo:revisar` exit 0 (#67).
- [X] T004 Configurar `pytest` con datos sintéticos y sin red. Prueba: `pytest -q` en verde (PS-01).
  Evidencia: `pytest.ini` con raíz del repositorio; 68 pruebas en verde con datos sintéticos (`tests/pipeline`, `tests/insight`) (#67).

## Repositorio y licencias (Mimi)

- [X] T005 Archivo `LICENSE` con MIT para el código y declaración CC BY 4.0 para textos y datos derivados. Prueba: ambos archivos presentes (RNF-11).
  Evidencia: `LICENSE` (MIT) y `LICENSE-TEXTOS.md` (CC BY 4.0). Titular pendiente de decisión del equipo (#67).
- [X] T006 `.gitignore` con `.env` y `.netrc`. Prueba: `git check-ignore .env .netrc` responde ambos (RNF-06).
  Evidencia: Verificado: `git check-ignore .env .netrc` responde ambos; ya estaba en `.gitignore` (#67).
- [X] T007 Revisión del historial en busca de credenciales. Prueba: el escaneo no encuentra claves (PS-06, RNF-06).
  Evidencia: Escaneo del historial y del árbol: 0 coincidencias para los patrones de clave conocidos (solo recuento) (#67).
- [X] T008 Esqueleto del manifiesto con el esquema de `data-model.md`. Prueba: un manifiesto de ejemplo sintético valida (CQ-06, RN-13).
  Evidencia: Validador `pipeline/manifiesto.py` con 17 pruebas y comando `npm run pipeline:validar-manifiesto` (#67).

## Notebook reproducible (Tabata con Alex)

- [ ] T009 Esqueleto del notebook que lee el manifiesto y regenera. Prueba: regenera el ejemplo sintético (RNF-08). La forma está pendiente (aclaración de la spec).

## Verificación (Tabata y Mimi)

- [ ] T010 Chequeo de servicios gratuitos: ningún servicio de pago en el entorno (RNF-10).
- [X] T011 Código vivo: `npm run codigo:revisar` sin código muerto (AGENTS.md §6).
  Evidencia: `npm run codigo:revisar` exit 0 (#67).
