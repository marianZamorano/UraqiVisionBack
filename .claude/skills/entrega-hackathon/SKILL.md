---
name: entrega-hackathon
description: Seguimiento del plan del hackathon de UraqiVision (§25), checklist de la demo de 7 láminas (§26) y de la entrega en NASA Space Apps 2026, incluida la declaración de uso de IA y las decisiones pendientes DP-01 y DP-02. Usar para saber cómo va el equipo frente al plan, preparar la demo o revisar la entrega antes de enviarla.
argument-hint: "estado | demo | entrega"
---

# Plan, demo y entrega del hackathon

Fuente: §24, §25, §26, §28 y §29 del documento maestro. Hackathon: sábado 14 de noviembre de 2026 a las
9:00 → domingo 15 a las 23:59 (hora local). **Conviene enviar a las 23:00 como máximo.**

## `estado`: cómo vamos frente al plan

1. Mira el reloj y ubica el bloque actual de la tabla de §25.
2. Para cada responsable (Alex, Tabata, Mimi, Joaco, Angie y Marian), compara lo planificado con lo que hay
   en el repositorio: specs y `tasks.md` marcadas, carpetas publicadas, componentes, pruebas.
3. Hito clave: **sábado 13:00, un antes/después real de San Ignacio en el mapa 2D**, aunque no esté
   pulido. El globo se construye después.
4. Señala riesgos de §24 que se estén materializando (descargas lentas, una sola persona procesando datos,
   Sentinel-2 sin imagen limpia) y la mitigación que ya prevé el documento.
5. No reasignes tareas ni cambies el alcance: propónlo al equipo.

## `demo`: 7 láminas en inglés (§26)

Portada + seis láminas, en este orden:

1. **La pregunta** (impacto y creatividad): San Ignacio de Velasco, 21 de julio de 2026, municipio con más
   focos de calor del país. ¿Quema, desmonte o ambos?
2. **Por qué radar** (validez): NISAR ve a través del humo; la banda L siente la estructura del bosque.
3. **El antes/después real**: el globo vuela a San Ignacio y el deslizador muestra datos NISAR de 2026.
4. **Quema o desmonte**: parches compatibles con quema, con pérdida previa de estructura y ambiguos.
5. **La validación**: acuerdo con Sentinel-2 y rango de hectáreas.
6. **Para quién** (relevancia): guardaparques y ciudadanía, en su idioma, con el enlace al sitio.

Que los jueces entiendan en segundos qué problema se resuelve, por qué el radar y qué obtiene el usuario.
**DP-01** (confirmar que se admiten 7 láminas contando la portada) debe estar resuelta antes.
Criterios de Space Apps: impacto, creatividad, validez, relevancia y presentación.

## `entrega`: checklist final

- [ ] **DP-02** resuelta: guías 2026 de entrega y evaluación, trabajo previo al evento, declaración de uso
      de IA y campo de referencias.
- [ ] Formulario de entrega en inglés.
- [ ] **Declaración de uso de IA**: dónde y cómo se usó (código, textos, imágenes, Insight) (§28).
- [ ] Sitio desplegado y enlace probado en escritorio y celular (PS-09).
- [ ] Repositorio público con licencia MIT (código) y CC BY 4.0 (textos y datos derivados), RNF-11.
- [ ] Manifiesto de datos y notebook reproducible (OE6, RNF-08).
- [ ] Página Acerca de con equipo, roles, licencias y citas de datos (RF-24).
- [ ] Ninguna clave en el bundle ni en el historial (PS-06).
- [ ] Ningún dato simulado presentado como resultado (RN-04); cifras con rango (RN-06).
- [ ] Sin logos de la NASA en material generado con IA (RN-12).
- [ ] Referencias revisadas (skill `rigor-y-fuentes`).

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **NASA Space Apps Challenge (2026). Dancing with the SARs** — <https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/>
  Citada en: §3. Aplica a: RF-01, RF-24. Enlázalo en Acerca de y en la entrega; sin logos ni marcas de la NASA en contenido generado con IA (RN-12).

<!-- referencias:fin -->
