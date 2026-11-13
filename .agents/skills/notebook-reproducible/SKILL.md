---
name: notebook-reproducible
description: Cómo construir el notebook reproducible de UraqiVision, que regenera los resultados de una estación desde manifest.json con el pipeline, registra la revisión visual (VC-05) y produce las figuras de control (OE6, RNF-08, §8.1). Usar al crear o revisar el notebook, al preparar la reproducibilidad para la entrega o al documentar decisiones de umbrales.
---

# Notebook reproducible

Fuente: OE6, RNF-08, §8.1 («repositorio abierto con notebook reproducible»), §17.2, §23.1 (VC-05 «registro
en el notebook») y §22. Responsable: Tabata.

## Para qué sirve

1. Que cualquiera pueda **regenerar** cada resultado publicado desde el manifiesto (RNF-08: «repetir el
   pipeline y comparar»).
2. Que quede **registrada** la revisión visual de parches (VC-05) y la elección de umbrales (VC-04).
3. Que el jurado vea el método de punta a punta.

## Reglas

1. **El notebook llama al pipeline, no lo duplica.** Importa las funciones del paquete del pipeline; si hay
   lógica en una celda que no existe en el paquete, muévela al paquete con su prueba.
2. **Entrada única**: `manifest.json`. El notebook vuelve a descargar o recortar los gránulos que lista
   (skill `ingesta-nisar-asf`) y verifica sus sumas; si una no coincide, se detiene.
3. **Sin credenciales en el notebook**: Earthdata por `.netrc` o variables de entorno. Antes de guardarlo,
   revisa que ninguna salida muestre tokens, rutas del home con datos personales ni la `MAP_KEY` de FIRMS.
4. **Salidas limpias en el repositorio**: guarda el notebook sin salidas pesadas (los rásteres no van dentro
   del `.ipynb`); las figuras de control que importan se exportan como PNG pequeños.
5. **Comparación final**: al regenerar, compara con lo publicado (`hectares.csv`, `change.tif`) y muestra si
   coincide exactamente o la diferencia, con su explicación.
6. **Orden de §12** visible como secciones: lectura en lineal → máscara y CQ → promedio → línea base → dB →
   cambio de HV → umbrales y 1 ha → clases.
7. **Hechos, hipótesis y decisiones** separados en celdas de texto; cada decisión de umbral con su
   justificación (VC-04) y cada hipótesis con su fuente (RN-05).
8. **Versiones**: la primera celda imprime las versiones de Python, GDAL, rasterio, xarray y NumPy.

## Figuras de control (Matplotlib)

- Serie de HV de una zona quemada frente a una zona de control (VC-03), en dB, con el hueco 27 jul–10 ago
  marcado.
- Histograma del cambio de HV con los dos umbrales.
- Mapa de porcentaje de datos válidos (CQ-05).
- Muestra de parches con su clase al lado de la imagen óptica (VC-05).
- Cada figura con fecha, órbita, polarización y unidades en el título o la leyenda.

## Revisión visual (VC-05)

Tabla en el notebook: id del parche, clase asignada, imagen óptica usada (fecha y fuente), veredicto de la
revisión (coincide / no coincide / no se puede ver) y comentario. Es la evidencia de «validación limitada»
cuando no hay Sentinel-2 limpio.

## Checklist

- [ ] Ejecutable de principio a fin desde `manifest.json`, con las sumas verificadas.
- [ ] Usa las funciones del pipeline; nada de lógica duplicada sin prueba.
- [ ] Ninguna credencial ni salida sensible.
- [ ] Compara lo regenerado con lo publicado.
- [ ] Revisión visual y elección de umbrales registradas.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). Open source software packages** — <https://nisar-docs.asf.alaska.edu/using-open-source/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-08. Paquetes de código abierto para trabajar con NISAR (respalda las herramientas de §18): consúltala al elegir y fijar versiones y cítala en el notebook reproducible.

<!-- referencias:fin -->
