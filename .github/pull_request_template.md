## Issues

<!--
PR de trabajo (rama tipo/N-descripcion → dev): cierra su issue con "Closes #N".
PR de promoción (dev → qa o qa → main): lista TODOS los issues que lleva con "Refs #N".
  Genera la lista con: node ai/scripts/issues-de-promocion.mjs dev qa   (o: qa main)
El workflow Trazabilidad exige que cada issue citado en los commits aparezca aquí.
-->

Closes #

## Tipo de PR

- [ ] Trabajo → `dev`
- [ ] Promoción `dev → qa` (actualiza **preproducción**)
- [ ] Promoción `qa → main` (actualiza **producción**; antes pasó por preproducción)

## Qué cambia

-

## Identificadores del documento maestro

<!-- RF, RNF, MC, RN, CQ, VC o PS que resuelve o toca este PR (docs/UraqiVisionDocumentoMaestrov1.1.pdf). -->

-

## Cómo se verificó

<!-- Comandos ejecutados y resultado (pytest, npm test, revisión en localhost o en preproducción). -->

-

## Checklist

- [ ] Cada commit cita su issue (#N) y todos esos issues aparecen en esta descripción.
- [ ] El workflow Trazabilidad está en verde (issues y formato Conventional Commits).
- [ ] Aprobaciones: hacia `dev` puedo fusionar mi propia PR; hacia `qa` o `main` aprobaron todos los
      colaboradores excepto yo, sobre el último commit (`npm run pr:estado -- N`).
- [ ] Dentro del alcance MVP (§8); ninguna decisión pendiente (DP-xx) implementada.
- [ ] Textos de interfaz en español e inglés (RNF-03).
- [ ] Sin claves ni credenciales en el código ni en el historial (RNF-06).
- [ ] Ningún dato simulado presentado como resultado (RN-04); sin dato nunca como cero (RN-13).
