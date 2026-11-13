# MCP servers

## Evaluación: ¿integración existente o servidor propio?

| Necesidad | Decisión | Motivo |
|---|---|---|
| Vercel: proyectos, despliegues, logs, errores | **Oficial** `https://mcp.vercel.com` (HTTP + OAuth) | Mantenido por Vercel. Expone 217 herramientas, incluidas de **escritura, despliegue y compras**: se restringe con el hook `pre-mcp-guard` (escritura → `ask`, compras → `deny`) y reglas deny/ask en settings |
| GitHub: PRs, issues, Actions | **Oficial** de GitHub (si se conecta) o `gh` CLI de lectura | No duplicar; mismas protecciones del hook MCP |
| Auditorías locales (stack, Vercel config, CI, contenedores, IaC, secretos, env, cuotas, readiness, política) | **Propio** `devops-readiness` | No existe equivalente; reutiliza el motor probado de `DevOps/lib` y da a los agentes estos análisis **sin shell** |
| Contenedores / IaC con ejecución real | No | Ejecutar `docker`/`terraform` desde un MCP ampliaría privilegios; se usan scripts bajo hooks |
| Logs y métricas | Vercel MCP (lectura) | Hobby no tiene Drains |
| Shell genérico, acceso indiscriminado a archivos | **Rechazado** | Contrario al mínimo privilegio |

## `devops-readiness` (propio)
- Transporte: stdio, JSON-RPC 2.0, mensajes delimitados por salto de línea. Sin dependencias.
- Protocolo: responde a `initialize` con la versión pedida si está en `2025-11-25`, `2025-06-18`, `2025-03-26` o `2024-11-05` (si no, la más reciente); `ping`; `tools/list`; `tools/call`. Notificaciones ignoradas.
- Raíz confinada: `DEVOPS_MCP_ROOT` (por defecto, el directorio de trabajo). Rechaza `..`, rutas absolutas externas y symlinks que salgan de la raíz.
- Todas las herramientas: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`.

### Herramientas
| Herramienta | Entrada | Salida |
|---|---|---|
| `detect_stack` | `{path?}` | `stack`, `components`, `findings`, `summary` |
| `audit_vercel_config` | `{path?, plan?: "hobby"}` | `findings`, `notes` |
| `audit_workflows` | `{path?}` | `findings`, `notes`, `files` |
| `audit_containers` | `{path?}` | `findings`, `notes`, `files` |
| `audit_iac` | `{path?}` | `findings`, `notes`, `files` (sin ejecutar terraform) |
| `scan_secrets` | `{path?}` | `findings` (tipo, archivo, línea, longitud; **nunca el valor**) |
| `check_env_example` | `{example, env_file?}` | `status[]` (clave, presente), `findings` |
| `get_free_tier_limits` | `{provider?}` | límites, `verifiedAt`, `stale`, fuentes |
| `check_free_tier_usage` | `{usage, warn_at?}` | `findings` por métrica (ok / near-limit / exceeded) |
| `deployment_readiness` | `{app_dir?, plan?}` | `level` (NOT_READY / CONFIG_PREPARED), `findings` |
| `check_approval_policy` | `{settings_path?}` | `findings` de controles ausentes |

Todas las salidas incluyen `summary` por severidad y truncan a 200 hallazgos (`truncated: true`).

### Errores
| Código | Caso |
|---|---|
| `-32700` | JSON inválido |
| `-32601` | Método no soportado |
| `-32602` | Herramienta desconocida, argumento faltante/no permitido/de tipo incorrecto, ruta inexistente o fuera de la raíz |
| `isError: true` | Fallo interno al ejecutar la herramienta (mensaje sin datos sensibles) |

### Instalación
En UraqiVision se declara en `ai/mcp/servers.json` y `npm run ai:sync` lo registra en `.mcp.json` y en la
configuración de cada asistente. Equivale a `node ai/devops/mcp-servers/devops-readiness/server.mjs`.
Autenticación: ninguna (local, solo lectura). Permisos: lectura de archivos bajo la raíz y `git` de lectura (readiness).

### Pruebas
Las pruebas de integración del repositorio de origen no se importaron. `npm run ai:verificar` comprueba que el
servidor arranca y responde al handshake `initialize`.
Prueba manual rápida:
```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | DEVOPS_MCP_ROOT=. node ai/devops/mcp-servers/devops-readiness/server.mjs
```
La integración en una sesión real de Claude Code (`/mcp`) no se ha probado en esta etapa porque instalarla activa el servidor en el proyecto; queda como paso de la persona.

## Vercel MCP (oficial)
```bash
claude mcp add --transport http vercel https://mcp.vercel.com
# en Claude Code: /mcp → autenticar (OAuth en el navegador)
```
La conexión concede al agente **los mismos permisos que tu cuenta de Vercel**. Mantén instalados `pre-mcp-guard` y las reglas `mcp__vercel__*` de la plantilla.
