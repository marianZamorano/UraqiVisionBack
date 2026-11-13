---
name: flujo-issues-y-pr
description: Flujo obligatorio de trabajo con git en UraqiVision, que cubre issue, rama tipo/N-descripcion desde dev, commits en formato Conventional Commits que citan su issue, push de la rama, PR a dev con Closes #N y promoción dev → qa → main por PR. Usar SIEMPRE antes de hacer un commit, un push, una rama o una PR, y al convertir tareas de Spec Kit en issues.
---

# Flujo issue → rama → commits → PR

Todo cambio queda trazado: cada issue muestra en GitHub los commits y la PR que lo resolvieron. Los hooks
de git, las guardas de los asistentes y el workflow `Trazabilidad` lo hacen cumplir: si te saltas un paso,
el commit, el push o la PR se rechazan con el motivo.

## Ramas y entornos

| Rama | Entorno | Para qué | Cómo recibe cambios |
|---|---|---|---|
| `main` | **Producción** (despliegue propio) | Lo que ven los usuarios y los jueces | Solo PR desde `qa` |
| `qa` | **Preproducción** (despliegue propio, separado de producción) | Probar la integración como si fuera producción antes de entregar | Solo PR desde `dev` |
| `dev` | Integración (sin despliegue obligatorio) | Juntar el trabajo del equipo | Solo PR desde ramas de trabajo |
| `tipo/N-descripcion` | Local | Una rama por issue (`feat/12-deslizador`, `fix/31-cero-sin-dato`) | Commits directos |

- **No existe una rama `master`.**
- **Cualquier rama entra primero a `dev` por PR**, luego `dev → qa` por PR y luego `qa → main` por PR. No se
  salta ningún paso (nada va directo de una rama de trabajo a `qa` o a `main`).
- Nunca se hace commit, push ni merge directo en `dev`, `qa` ni `main`.
- `qa` y `main` tienen **cada una su propio despliegue**. El proveedor de hospedaje está pendiente (DP-06,
  GitHub Pages o Vercel): no lo elijas ni configures despliegues sin que el equipo lo decida.

## Pasos

1. **Issue**: cada trabajo empieza con un issue (plantilla *Tarea* o *Defecto*), con sus identificadores del
   documento maestro y su criterio de aceptación.
   - Desde Spec Kit: `/speckit-taskstoissues` convierte las tareas de `tasks.md` en issues.
   - A mano: `gh issue create --template tarea.yml` (pide confirmación: crea algo en GitHub).
2. **Rama y PR automáticas**: al crear el issue, el workflow `Issue a PR` crea la rama `tipo/N-titulo` desde
   `dev` (`feat` para tareas, `fix` para defectos) con un commit vacío que cita el issue, abre una **PR en
   borrador** hacia `dev` con `Closes #N` y comenta en el issue cómo empezar. **Usa esa rama**, no crees otra:
   `git fetch origin && git switch tipo/N-titulo`. El número de la rama es el del issue: así cada commit recibe
   `Refs #N` automáticamente. (Si la automatización no corrió, créala a mano: `git switch -c feat/<N>-descripcion` desde `dev`.)
3. **Commits** en formato Conventional Commits (lo valida commitlint):

   ```
   tipo(alcance): descripción en minúscula (IDENTIFICADORES) #N

   Cuerpo opcional: qué cambió y por qué, en líneas de hasta 100 caracteres.
   ```

   - **tipo**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - **alcance** (sugerido): módulo de §19 (`ingesta`, `ciencia`, `validacion`, `publicacion`, `insight`,
     `globo`, `mapa`, `atlas`, `interfaz`) o parte del repositorio (`ai`, `guardas`, `skills`, `specs`,
     `docs`, `deps`, `ci`).
   - **descripción**: en minúscula, sin punto final, cabecera de 100 caracteres como máximo.
   - **identificadores** del documento (RF, RNF, MC, RN, CQ, VC, PS) que resuelve.
   - **issue**: `#N` en la cabecera o `Refs #N` en el cuerpo (en ramas `tipo/N-…` se agrega solo).
   - Sin `Co-Authored-By` de asistentes de IA y sin nombrar proyectos externos de los que se tomó código.
   - Ejemplo: `feat(mapa): deslizador antes/después operable por teclado (RF-06) #12`.
   - **Un commit por tema.** Si hay muchos cambios, primero mira la propuesta de división:
     `node ai/scripts/dividir-commits.mjs` (o `--json`). Agrupa por tema (dependencias, guardas, skills,
     subagentes, configuración de asistentes, GitHub, specs, documentación…) y sugiere un mensaje por grupo.
   - **Siempre se pregunta a la persona** antes de dividir: puede convenir mantener todo junto. Presenta los
     grupos y las opciones (dividir así, ajustar grupos o mensajes, un solo commit) y espera su respuesta.
     - Si aprueba dividir: `node ai/scripts/dividir-commits.mjs --aplicar --si` (con `--mensajes archivo.json`
       si ajustaron los mensajes), o crea tú los commits grupo por grupo.
     - Si aprueba un solo commit: `URAQI_UN_COMMIT=1 git commit …` (solo con esa aprobación explícita).
   - El hook `commit-msg` detecta los commits que mezclan 3 o más temas (o 2 temas con 8 o más archivos) y los
     detiene: en una terminal pregunta «¿Mantener todo en un solo commit? [s/N]»; sin terminal (agentes, IDE)
     bloquea hasta que la persona decida. Un commit de un solo tema nunca se detiene.
4. **Push de la rama**: `git push -u origin feat/<N>-descripcion` (pide confirmación).
5. **PR hacia dev**: `gh pr create --base dev --fill`, con la plantilla completa y `Closes #N` en la
   descripción. El workflow `Trazabilidad` revisa la PR, los issues de cada commit y su formato.
6. **Revisión y aprobación** (reglas en `ai/hooks/lib/aprobaciones.mjs`):

   | PR hacia | Quién aprueba | Cuándo se puede fusionar |
   |---|---|---|
   | `dev` | El autor puede fusionar **su propia PR** tras confirmar; nadie más está obligado | Trazabilidad en verde y sin cambios solicitados |
   | `qa` y `main` | **Todos los colaboradores excepto el autor** | Todos aprobaron el **último commit**, checks en verde y sin cambios solicitados |

   - GitHub no permite aprobar la propia PR: en `dev`, «aprobarla» es fusionarla tras confirmar.
   - Al abrir una PR hacia `qa` o `main`, el workflow `Aprobaciones` pide revisión a quienes faltan.
   - Una aprobación de un commit anterior queda obsoleta: si se suben commits nuevos, hay que volver a aprobar.
   - Las invitaciones al repositorio sin aceptar no cuentan como revisores.
   - Comandos (todos piden confirmación; un asistente usa `--si` solo después de que la persona confirmó):
     - `npm run pr:pendientes`: PR que esperan tu aprobación y estado de las tuyas.
     - `npm run pr:estado -- N`: quién aprobó, quién falta y si se puede fusionar.
     - `npm run pr:aprobar -- N`: muestra el resumen y aprueba.
     - `npm run pr:fusionar -- N`: comprueba las reglas y fusiona con merge commit.
   - **Aviso automático**: al iniciar la sesión, y cada 10 minutos al escribir, los hooks consultan GitHub y,
     si hay PR nuevas por aprobar o tuyas listas para fusionar, se lo indican al asistente. El asistente
     **avisa a la persona y le ofrece revisarlas**; nunca aprueba ni fusiona sin su confirmación.
   - Los asistentes no pueden usar `gh pr merge` ni aprobar con `gh pr review --approve` o la API: las guardas
     lo bloquean y obligan a usar estos comandos.
7. **Promoción**: PR `dev → qa`, que actualiza el despliegue de **preproducción**, y, tras probar ahí, PR
   `qa → main`, que actualiza **producción**. Una promoción no tiene un issue propio, pero **debe listar
   con `Refs #N` todos los issues que lleva**. Genera la lista con
   `node ai/scripts/issues-de-promocion.mjs dev qa` (o `qa main`) y pégala en la descripción. Antes de
   la PR a `main`, el subagente `release-readiness-reviewer` da su veredicto.
   Las promociones se abren **solo cuando la persona las pide de forma explícita**. Antes de abrirlas, el
   subagente `revisor-codigo-vivo` (skill `codigo-vivo`) revisa que no haya código roto, muerto o desconectado
   y el CI/CD por rama: `npm run codigo:revisar`. La guarda `[uraqi-guard:codigo-no-vivo]` detiene
   `gh pr create --base qa|main` si hay errores, y el workflow Código vivo los comenta en la PR con su plan.

## Buenas prácticas de PR (automáticas)

El workflow `Buenas prácticas de PR` (reglas en `ai/hooks/lib/buenas-practicas-pr.mjs`) revisa cada PR hacia
`dev`, `qa` o `main` y deja un comentario de resumen que se actualiza solo:

| Revisa | Regla | ¿Bloquea? |
|---|---|---|
| Título | Trabajo: Conventional Commits (`feat(mapa): …`). Promoción: `Promoción dev → qa: …` o `Promoción qa → main: …` | Sí |
| Rama | Hacia `dev`: `tipo/N-descripcion` en minúsculas, y la PR cierra ese issue #N | Sí |
| Descripción | Secciones «Issues», «Qué cambia» y «Cómo se verificó» completas, sin `(completar)` | Sí, salvo en borrador |
| Referencias | Cada `Closes`/`Refs #N` es un issue que existe, no una PR | Sí |
| Conflictos | Sin conflictos con la rama destino; aviso si está desactualizada | Sí / aviso |
| Secretos | Ninguna línea agregada con claves | Sí |
| Calidad | `node ai/sync.mjs --check` y `npm run test:guardas` en verde | Sí |
| Tamaño | Aviso si una PR de trabajo supera 800 líneas o 40 archivos (sin generados) | Aviso |

También pone etiquetas `tipo: …` y `tamaño: XS…XL` y asigna la PR a su autor. En GitHub solo se permite
fusionar con **merge commit**.

## Ramas: nunca se borran y toda rama nueva se sube

- **Ninguna rama se borra al fusionar**, ni local ni remota: las ramas son parte de la trazabilidad entre
  issues, commits y PR. Las guardas impiden a los asistentes borrarlas (`git branch -d/-D`, `git push --delete`,
  `git push origin :rama`, la API). Solo una persona decide borrar una rama, si crea confusión o su código ya no
  sirve.
- **Toda rama nueva se sube a origin**: el hook `post-checkout` hace `git push -u origin <rama>` al crearla (si
  no hay red, avisa para subirla después) y el inicio de sesión avisa de ramas locales sin subir.

Guarda local: `gh pr create` exige `--base` (sin él, gh apunta a `main`) y solo acepta `tipo/N → dev`,
`dev → qa` y `qa → main`.

## Estado automático de los issues

El workflow `Estado de issues` (reglas en `ai/hooks/lib/estado-issues.mjs`) actualiza cada issue citado en la
descripción de la PR o en sus commits. No hay que moverlos a mano:

| Evento | Estado del issue |
|---|---|
| Se crea el issue (PR en borrador automática) | `estado: en progreso` |
| La PR se marca como lista para revisión | `estado: en revisión` |
| La PR se fusiona en `dev` (**aceptada**) | `estado: en dev`, comentario con la PR y **se cierra** |
| La PR se cierra sin fusionar | se quitan `en progreso` / `en revisión` (el issue queda abierto) |
| Se abre una PR hacia `qa` o `main` | se crea su **issue de promoción** con los issues que lleva |
| Se fusiona en `qa` **con aprobación completa** | `estado: en preproducción` y se cierra el issue de promoción |
| Se fusiona en `main` **con aprobación completa** | `estado: en producción` y se cierra el issue de promoción |
| Se fusiona en `qa` o `main` **sin** aprobación completa | **no cambia ningún estado**; aviso y etiqueta `aprobación incompleta` |

- **PR aceptada = issue cerrado, sí o sí.** Solo sigue abierto el issue cuya PR no se aprobó.
- GitHub solo cierra issues con `Closes #N` al fusionar en `main` (la rama por defecto); el cierre al entrar a
  `dev` lo hace este workflow. La etiqueta sigue el recorrido hasta producción con el issue ya cerrado.
- **Protección** (workflow `Protección de issues`): se revierte poner o quitar etiquetas `estado:` a mano,
  cerrar un issue de promoción sin aprobación completa, cerrar un issue con PR en curso (si el trabajo se
  descarta, cierra la PR) y reabrir un issue cuya PR ya fue aceptada (para un problema nuevo, abre otro issue).
- Los workflows que reaccionan a eventos de issues (`Issue a PR`, `Protección de issues`) corren desde la rama
  por defecto: funcionan cuando están en `main`.
- Revisar qué haría con una PR: `npm run issues:estado -- --pr N --simular`. Para aplicarlo sin que la
  protección lo revierta, hazlo con la automatización: `gh workflow run estado-issues.yml --ref dev -f pr=N`.

## Trazabilidad completa (sin excepciones)

- **Todo commit** que llegue a `dev`, `qa` o `main` cita su issue y viaja en una PR.
- **Toda PR**, hacia cualquiera de las tres ramas, menciona en su descripción **todos** los issues que citan
  sus commits. Así, desde un issue se ven sus commits y las tres PR por las que pasó: → `dev`, `dev → qa` y
  `qa → main`.
- Una PR hacia `dev` además **cierra** al menos un issue (`Closes #N`).
- A `qa` solo se llega desde `dev`, y a `main` solo desde `qa`. El workflow `Trazabilidad` rechaza cualquier
  otro origen.
- Al aprobar en GitHub, usa **merge commit** (no squash), para conservar cada commit con su issue en las tres
  ramas.

## Si algo se rechaza

| Mensaje | Qué hacer |
|---|---|
| `[uraqi-guard:commit-en-main]` | Estás en `dev`, `qa` o `main`: `git switch -c feat/<N>-descripcion` (los cambios se mueven con la rama) |
| `[uraqi-guard:commit-sin-issue]` | Agrega `#N` al mensaje o crea el issue primero |
| Error de commitlint (`type-enum`, `subject-case`, `header-max-length`…) | Corrige el formato del mensaje según el paso 3 |
| `[uraqi-guard:commit-grande]` | Muestra la división propuesta a la persona y pregúntale: dividir (`dividir-commits.mjs --aplicar`) o un solo commit (`URAQI_UN_COMMIT=1`) |
| `[uraqi-guard:push-to-protected]` o `pre-push` | No hagas push a `dev`, `qa` ni `main`: push de tu rama y PR |
| `[uraqi-guard:pr-merge-directo]` o `pr-aprobar-directo` | Usa `npm run pr:fusionar -- N` o `npm run pr:aprobar -- N`, con la confirmación de la persona |
| Workflow `Aprobaciones` en rojo | Faltan aprobaciones (qa/main) o hay cambios solicitados: `npm run pr:estado -- N` dice quién falta |
| Workflow `Trazabilidad`: «el issue #N aparece en los commits pero no en la PR» | Agrega `Closes #N` (PR a `dev`) o `Refs #N` (promoción) a la descripción |
| Workflow `Trazabilidad`: commit sin issue | Corrígelo con `git commit --amend` solo si la rama es tuya y aún no la revisó nadie |
| Workflow `Trazabilidad`: «a qa solo se llega desde dev» | Cierra la PR y ábrela hacia `dev`; luego promueve `dev → qa` |

## Reglas para asistentes de IA

- No crees issues, ramas remotas ni PR, ni hagas push, sin la aprobación de la persona: son acciones en GitHub.
- Nunca uses `--no-verify` ni desactives `core.hooksPath` para saltarte los controles (las guardas lo bloquean).
- Si el trabajo no tiene issue, propón el texto del issue (título, identificadores, criterio de aceptación)
  y espera la aprobación antes de crearlo.
