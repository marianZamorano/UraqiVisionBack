# MCP server `qa-evidence`

Servidor MCP **de solo lectura** para analizar artefactos de QA (resultados de pruebas, contratos de API,
resultados de k6, cobertura) sin ejecutar pruebas, sin escribir archivos y sin acceso a red.

## Propósito y casos de uso

- Un agente analiza los resultados de una ejecución que ya ocurrió (`parse_test_results`).
- Validar una respuesta capturada contra el esquema del contrato (`validate_json_schema`).
- Detectar cambios incompatibles entre dos versiones de una API (`diff_api_contracts`).
- Comprobar que un SQL es de solo lectura **antes** de enviarlo a un MCP de base de datos (`check_sql_readonly`).
- Evaluar quality gates y construir un informe de evidencias que la persona decide si guardar.

## Herramientas

| Herramienta | Entrada (obligatorio en **negrita**) | Salida |
|---|---|---|
| `discover_test_assets` | `path`, `maxFiles` (≤ 20000) | Manifiestos, lockfiles, tecnologías declaradas, artefactos de testing |
| `read_api_contract` | **`path`** | `{kind, operations[]}` (OpenAPI/Swagger) o `{kind, requests[]}` (Postman) |
| `diff_api_contracts` | **`oldPath`**, **`newPath`** | `{compatible, summary, changes[]}` |
| `parse_test_results` | **`path`**, `includePassed`, `maxCases` (≤ 200) | `{format, totals, cases[], truncatedCases}` |
| `validate_json_schema` | `schema`\|`schemaPath`, `data`\|`dataPath`, `schemaPointer` | `{valid, errors[], unsupported[]}` |
| `summarize_k6_results` | **`path`**, `thresholds{p95Ms,p99Ms,errorRate,minChecksRate}` | `{summary, evaluation}` |
| `evaluate_quality_gate` | **`gates[]`**, `metrics`, `resultsPaths[]`, `coveragePath`, `k6Path` | `{metrics, passed, results[]}` |
| `check_sql_readonly` | **`sql`** | `{readOnly, destructive, statements[]}` |
| `build_evidence_report` | **`title`**, `resultsPaths[]`, `k6Path`, `facts[]`, `hypotheses[]`, `recommendations[]`, `notExecuted[]`, `context` | `{markdown, written:false}` |

Los esquemas JSON completos se publican en `tools/list` (ver `tools.mjs`). Todas las herramientas declaran
`annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }`.

## Seguridad

| Control | Implementación |
|---|---|
| Confinamiento de rutas | `resolveInside`: rechaza `..`, rutas absolutas externas, bytes nulos y symlinks que salen de la raíz |
| Archivos de secretos | `.env`, `*.pem`, `*.key`, `id_rsa`, `.npmrc`, `.ssh/`… → acceso denegado sin leerlos |
| Validación de entradas | Cada llamada se valida contra su `inputSchema` (`additionalProperties: false`) |
| Límites | Archivos ≤ 5 MB, salida ≤ 200 000 caracteres (truncada con aviso), 20 s por llamada, líneas ≤ 10 MB |
| Sanitización | Toda salida pasa por `redactDeep` (secretos y claves sensibles → `[REDACTED]`) |
| Errores | Errores de herramienta → `isError: true` con mensaje controlado; errores internos no exponen trazas |
| Logs | Solo en stderr, sin contenidos ni rutas de secretos |
| Sin interfaces genéricas | No hay herramientas de shell, ejecución de código, escritura ni lectura arbitraria |

## Protocolo

- Transporte stdio, JSON-RPC 2.0, un mensaje por línea. stdout solo contiene mensajes del protocolo.
- Ciclo de vida con `initialize` (revisiones `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`). Si el
  cliente pide otra versión, responde con la más reciente soportada.
- Métodos: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`.
- `structuredContent` se incluye solo si la versión negociada es ≥ `2025-06-18`.
- **Limitación**: no implementa la revisión moderna `2026-07-28` (sin handshake, `server/discover`). Claude
  Code 2.1.107 usa el handshake legacy, que sí está soportado.

## Instalación y configuración

En UraqiVision se declara en `ai/mcp/servers.json` y `npm run ai:sync` lo registra en `.mcp.json` y en la
configuración de cada asistente.

- Nombre de las herramientas en Claude Code: `mcp__qa-evidence__<herramienta>`.
- Raíz de lectura: `QA_EVIDENCE_ROOT` si está definida; si no, el directorio de trabajo del proceso (la
  carpeta desde la que se lanzó Claude Code).
- Dependencias: solo Node.js ≥ 18. Sin autenticación (no accede a sistemas externos).

Uso fuera de Claude Code (p. ej. con otro cliente MCP):

```bash
QA_EVIDENCE_ROOT=/ruta/proyecto node ai/qa/mcp-servers/qa-evidence/server.mjs
```

## Pruebas

Las pruebas del repositorio de origen no se importaron (en `ai/qa/tests/` solo quedan sus fixtures).
`npm run ai:verificar` comprueba que el servidor arranca y responde al handshake `initialize`.

## Extensiones no implementadas (requieren autorización)

- Métricas de CI/CD (GitHub Actions/GitLab): exigen token de API → servidor separado con credenciales por
  `userConfig` sensible y herramientas de solo lectura.
- Sistemas de gestión de pruebas (TestRail, Xray, Zephyr): misma separación; cualquier escritura en un
  servidor aparte y sujeta al hook `ask`.
