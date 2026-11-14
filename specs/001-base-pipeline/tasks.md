# Tareas: base del pipeline (001-base-pipeline)

**Prompt:** P-PROY-04 (issue #64). Ninguna tarea está hecha: la implementación empieza en P-PROY-06 y necesita tu
aprobación para instalar dependencias. Responsables: **Tabata** (entorno), **Mimi** (repositorio y licencias).

## Entorno (Tabata)

- [ ] T001 Archivo de dependencias con las versiones de `plan.md` §1; las pendientes (openSEPPO, GDAL) se verifican antes. Prueba: instalación en entorno limpio (SC-001).
- [ ] T002 Verificar openSEPPO y GDAL ≥ 3.13 contra su documentación vigente. Prueba: `gdalinfo --version` ≥ 3.13 (§18). Bloqueado por la verificación.
- [ ] T003 Crear `ingesta/`, `ciencia/`, `validacion/`, `publicacion/` con la regla de dependencias de `docs/arquitectura.md`. Prueba: `pytest` importa cada paquete (PS-01).
- [ ] T004 Configurar `pytest` con datos sintéticos y sin red. Prueba: `pytest -q` en verde (PS-01).

## Repositorio y licencias (Mimi)

- [ ] T005 Archivo `LICENSE` con MIT para el código y declaración CC BY 4.0 para textos y datos derivados. Prueba: ambos archivos presentes (RNF-11).
- [ ] T006 `.gitignore` con `.env` y `.netrc`. Prueba: `git check-ignore .env .netrc` responde ambos (RNF-06).
- [ ] T007 Revisión del historial en busca de credenciales. Prueba: el escaneo no encuentra claves (PS-06, RNF-06).
- [ ] T008 Esqueleto del manifiesto con el esquema de `data-model.md`. Prueba: un manifiesto de ejemplo sintético valida (CQ-06, RN-13).

## Notebook reproducible (Tabata con Alex)

- [ ] T009 Esqueleto del notebook que lee el manifiesto y regenera. Prueba: regenera el ejemplo sintético (RNF-08). La forma está pendiente (aclaración de la spec).

## Verificación (Tabata y Mimi)

- [ ] T010 Chequeo de servicios gratuitos: ningún servicio de pago en el entorno (RNF-10).
- [ ] T011 Código vivo: `npm run codigo:revisar` sin código muerto (AGENTS.md §6).
