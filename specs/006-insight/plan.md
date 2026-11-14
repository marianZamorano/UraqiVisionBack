# Plan de implementación: Insight (006-insight)

**Estado:** plan escrito a posteriori (P-INSIGHT-03, issue #44). El código se implementó antes (PR #40 y #42); esa
desviación está declarada en `sdd/historial/` (issue #43) y en `specs/006-insight/tasks.md`.

**Fuentes:** documento maestro §8.2, §18, §21, §21.1, §21.2, §23.3, §28, §29; RF-16 a RF-18; RN-09, RN-10, RN-14;
RNF-06, RNF-07; PS-05, PS-06. Spec: `specs/006-insight/spec.md`. Contrato: `contracts/post-api-insight.md`.

## 1. Resumen

Insight responde preguntas sobre la estación abierta con el contenido publicado de esa estación, el método y el glosario.
Cada respuesta cita su sección. Si el proveedor falla o no hay límites configurados, responde con textos de plantilla.

## 2. Arquitectura

Capas en `insight/` (decisión propuesta en `docs/arquitectura.md`, pendiente de revisión del equipo):

| Capa | Módulos | Responsabilidad |
|---|---|---|
| Dominio | `dominio/contenido.py`, `dominio/limites.py`, `dominio/plantillas.py` | Contenido de la estación, límites de uso, plantillas de respaldo. |
| Aplicación | `aplicacion/contrato.py`, `aplicacion/servicio.py` | Validar la solicitud y orquestar la respuesta. |
| Infraestructura | `infraestructura/adaptadores.py` | Adaptador del proveedor de IA. Única capa que conoce la clave. |
| Interfaz | `interfaz/api.py`, `scripts/insight_local.py` | Raíz de composición y puntos de entrada. |

Regla: las dependencias solo apuntan hacia el dominio.

## 3. Flujo de una solicitud

1. La interfaz recibe el cuerpo y el identificador de sesión.
2. Se arma el servicio con los límites y el proveedor del entorno. Sin límites: 503. Sin clave: proveedor no disponible.
3. El servicio valida `station_id`, `question` y `lang`. Si algo falla: 400.
4. Se cuenta la pregunta en la sesión. Si es demasiado larga: 413. Si la sesión ya llegó al máximo: 429.
5. Si la estación no es la abierta, o la pregunta pide daños, pronósticos o confirmar una causa: plantilla, sin llamar
   al proveedor (RN-10, RN-14).
6. Se llama al proveedor con solo las secciones de la estación abierta.
7. Si falla, si no responde, o si no cita una sección válida: plantilla de respaldo (RF-18).
8. Si responde con una cita válida: respuesta con `source = "ia"`.
9. Se registran solo metadatos: estación, idioma, longitud, fuente, código y latencia.

## 4. Contrato

Ver `contracts/post-api-insight.md`. Lo que fija §21.1 se separa de lo que es propuesta de diseño.

## 5. Decisiones

- **Fijado por §21.1:** `POST /api/insight`; `station_id`, `question`, `lang`; respuesta `answer`, `citations`, `source`.
- **Propuesta de diseño (no fijada por §21.1):** códigos 400, 413, 429 y 503; cuerpo de error `{"error", "detalle"}`;
  identificador de sesión como argumento de la función.
- **Aclaración P-INSIGHT-02:** límites por sesión del navegador, en memoria; citas solo de secciones existentes;
  declinar otra estación; plantillas por idioma e intención; logs solo con metadatos.
- **Pendiente DP-04:** valores de los límites. El código no los fija: sin configurar responde 503.
- **Pendiente DP-06:** hospedaje. §18 nombra Vercel para la función; eso no es una decisión tomada.
- **Pendiente con la web:** nombre del encabezado de sesión y cómo la web muestra 429 y 503 (la plantilla de RF-18).

## 6. Riesgos

- **Contador en memoria (hipótesis):** cada instancia serverless cuenta por separado; RNF-07 podría no cumplirse de forma
  fiable entre instancias. Hay que probarlo en el entorno de despliegue. Persistir el contador sería un cambio de
  arquitectura que se consulta al equipo (§8.2 excluye bases de datos y colas).
- **Contrato con la web no verificado (hipótesis):** `UraqiVision` no se revisó en este plan.
- **Proveedor no verificado:** el adaptador arma la petición de la API de mensajes, pero no se ha probado con una clave real.
- **Heurística de causa:** cualquier pregunta con «por qué» se declina. Es conservadora y puede bloquear preguntas válidas.

## 7. Verificación

- `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q` → 49 pruebas en verde (ejecutado al implementar).
- `npm run test:guardas` → 103 en verde (ejecutado al implementar).
- Prueba real del proveedor: **pendiente**. La hace la persona con su clave en `.env` local; no se lee ni se muestra.

## 8. Dependencias

- P-INSIGHT-02 (hecho). P-PROY-07 (pendiente, de Tabata y Mimi): ver `sdd/01-proyecto.md`.
- Revisión del equipo de `docs/arquitectura.md`: pendiente.
