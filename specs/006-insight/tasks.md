# Tareas: Insight (006-insight)

**Estado:** tareas escritas a posteriori (P-INSIGHT-04, issue #45). Las marcadas `[X]` están hechas y verificadas
en el repositorio; las `[ ]` están pendientes. Ninguna pendiente se marca como hecha. Desviación de orden declarada en #43.

Convención: `T0NN` identifica la tarea; `[X]` hecha, `[ ]` pendiente. Referencias: RF, RN, RNF, PS del documento maestro.

## Hechas

- [X] T001 Spec de Insight con RF-16 a RF-18, RN-09, RN-10, RN-14, RNF-06, RNF-07, PS-05 (#33, PR #36).
- [X] T002 Aclaraciones P-INSIGHT-02: sesión del navegador, citas, otra estación, plantillas, logs (#39, PR #40).
- [X] T003 Pruebas de contrato, límites, citas, plantillas y seguridad, escritas antes del código (RF-16 a RF-18; RNF-07; PS-06) (#39).
- [X] T004 Núcleo: validación de la solicitud, límites por sesión y de longitud, citas válidas, plantillas, logs solo con metadatos (RF-16, RF-18, RN-09, RN-10, RN-14).
- [X] T005 Adaptador de proveedor configurable por entorno; la clave nunca sale de `infraestructura/` (RNF-06, PS-06).
- [X] T006 Punto de entrada `interfaz/api.py` y comando local `npm run insight:local` (#39, PR #40).
- [X] T007 Arquitectura en capas `dominio/`, `aplicacion/`, `infraestructura/`, `interfaz/` y su documento (#41, PR #42). Pendiente de revisión del equipo (ver T015).
- [X] T008 Plan y contrato escritos a posteriori con la desviación declarada (#44).
- [X] T009 Registro del código en el historial del SDD como parcial (#43).

## Pendientes

- [ ] T010 **Prueba real del proveedor.** La hace Mimi con su clave en `.env` local, con `npm run insight:local`. No se lee ni se muestra la clave. Criterio: respuesta 200 con `source = "ia"` y cita válida, o plantilla si falla. Bloqueado por la clave (Mimi).
- [ ] T011 **Verificar la API de mensajes del proveedor** contra su documentación vigente antes de T010. El adaptador (`infraestructura/adaptadores.py`) no se ha probado contra la API real.
- [ ] T012 **DP-04 (límites de uso).** Decidir los valores de preguntas por sesión y de caracteres. Decisión de Mimi (sábado). Bloquea el despliegue, no las pruebas.
- [ ] T013 **DP-06 (hospedaje).** Decidir GitHub Pages o Vercel. Decisión de Mimi (sábado). §18 nombra Vercel: no se asume.
- [ ] T014 **Encabezado de sesión y 429/503 con la web.** Acordar con `UraqiVision` el nombre del encabezado y lo que muestra la web. Bloquea la integración.
- [ ] T015 **Revisión del equipo de la arquitectura** en capas (`docs/arquitectura.md`), exigida por AGENTS.md §3.2.
- [ ] T016 **Decidir si las preguntas sugeridas (RF-17) se exponen por HTTP** o se leen de `station.json`. Hoy solo existe el método en el dominio.
- [ ] T017 **Prueba del límite de sesión en el entorno de despliegue** (hipótesis: el contador en memoria no es fiable entre instancias; RNF-07). Depende de T012 y T013.
- [ ] T018 **Análisis de consistencia** entre spec, plan, contrato y código (P-INSIGHT-05, #46).
- [ ] T019 **Aprobación de la persona** antes de cerrar P-INSIGHT-06 (puerta «apruebo» de P-INSIGHT-05).

## Lo que no entra en este SDD

- Cuentas de usuario, bases de datos y colas (§8.2).
- Despliegue (espera a DP-06 y a la aprobación del equipo).
