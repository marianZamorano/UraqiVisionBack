# Arquitectura en capas del backend

**Estado:** propuesta aprobada por Mimi el 14 de noviembre de 2026; pendiente de revisión del equipo (AGENTS.md §3,
punto 2: cambios de arquitectura se consultan al equipo). Se aplica desde Insight (`insight/`) y será la referencia
para los paquetes del pipeline (ingesta, ciencia, validación y publicación) cuando existan (`P-PROY-02`).

El documento maestro describe la arquitectura estática (§17) y el adaptador de proveedor (§21.2), pero no fija capas
internas. Esta organización es una decisión de implementación: no cambia el alcance ni los contratos de §17.3 y §21.1.

## Las cuatro capas

| Capa | Qué contiene | Puede importar de |
|---|---|---|
| **Dominio** (`dominio/`) | Reglas del negocio y datos: contenido de la estación, límites de uso, plantillas de respaldo. | Solo la biblioteca estándar. |
| **Aplicación** (`aplicacion/`) | Casos de uso: validar la solicitud (`contrato.py`) y orquestar una respuesta (`servicio.py`). | Dominio. |
| **Infraestructura** (`infraestructura/`) | Lo que habla con el exterior: el adaptador del proveedor de IA. Única capa que conoce la clave. | Solo la biblioteca estándar. |
| **Interfaz** (`interfaz/`) | Puntos de entrada: `api.py` (POST /api/insight) y el comando local `scripts/insight_local.py`. | Aplicación, dominio e infraestructura. |

## Reglas

1. **Las dependencias solo apuntan hacia adentro.** El dominio no importa aplicación, infraestructura ni interfaz.
2. **La interfaz es la raíz de composición.** Es la única que arma las capas juntas: crea el adaptador, los límites y
   el servicio. Ninguna otra capa instancia a otra.
3. **La clave del proveedor solo vive en `infraestructura/adaptadores.py`** (RNF-06, PS-06). Las pruebas de
   `tests/insight/test_seguridad.py` revisan que no aparezca en el código.
4. **Las reglas de contenido viven en el dominio**, no en la interfaz: por ejemplo, las citas válidas y las plantillas
   por intención (RN-09, RN-10, RN-14).

## Cómo se comprueba

- Las pruebas de Python (`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q`) cubren cada capa.
- El revisor de código vivo (`npm run test:guardas`) confirma que no hay código muerto: cada módulo es alcanzable desde
  un punto de entrada real (la API o el comando local).
- Cada cambio de dependencias entre capas se revisa en la PR con esta regla.

## Pendiente

- Revisión del equipo de la decisión (AGENTS.md §3, punto 2).
- Aplicar la misma estructura a los paquetes del pipeline cuando existan (P-PROY-02).
