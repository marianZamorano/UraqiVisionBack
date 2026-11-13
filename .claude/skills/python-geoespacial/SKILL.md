---
name: python-geoespacial
description: Prácticas de código Python geoespacial para el pipeline de UraqiVision con rasterio, xarray, rioxarray, NumPy, SciPy y GeoPandas, incluidos COG float32 sin pérdida, CRS y grilla, manejo de sin dato con NaN, conversión lineal a dB, área de píxel en UTM y pruebas pytest con rásters sintéticos (MC-01 a MC-07, RNF-09, PS-01, PS-02). Usar al escribir o revisar código Python del pipeline o sus pruebas.
---

# Python geoespacial en el pipeline

Fuente: §12, §18, §22 y §23.3 del documento maestro. Las reglas científicas están en
`ciencia-radar-nisar`; esta skill dice **cómo escribir el código** para no romperlas. Antes de usar una API
concreta, verifícala con `context7` o la documentación oficial.

## Estructura (propuesta)

- Funciones **puras** para la ciencia (`a_db`, `linea_base`, `cambio_hv`, `hectareas`): reciben arrays y
  devuelven arrays, sin leer archivos ni red. Así se prueban en milisegundos con datos sintéticos.
- La lectura y escritura de archivos queda en una capa aparte (`io`), que es la única que toca rasterio.
- Cada función cita el método que implementa en su docstring (`"""MC-03: cociente de HV en dB."""`).

## Reglas

1. **Lineal primero, dB después**: `a_db(x) = 10 * np.log10(x)` solo sobre la línea base y la fecha ya
   promediadas en lineal. Nunca `mean` ni `median` sobre valores en dB.
2. **Sin dato = `np.nan`** en float32. Usa `np.nanmedian`, `np.nanmean` y máscaras booleanas. Prohibido
   `fillna(0)`, `np.nan_to_num`, `astype(int)` o `nodata=0` sobre datos de análisis (RN-13).
3. **Potencias ≤ 0**: `log10` de 0 da `-inf`; enmascara antes (`np.where(x > 0, x, np.nan)`) y registra
   cuántos píxeles se enmascararon.
4. **Misma grilla**: antes de apilar fechas, comprueba CRS, transform, ancho y alto iguales (CQ-01). Si no
   coinciden, la fecha se excluye con su motivo; no se remuestrea el análisis (§22).
5. **Área de píxel** desde el transform de la grilla UTM (`abs(a * e)` en m², `/ 10_000` para hectáreas);
   no la escribas fija (MC-07).
6. **Mediana de la línea base** sobre el eje del tiempo con al menos 3 fechas válidas por píxel; con menos,
   el píxel queda `NaN` y se cuenta como «datos insuficientes» (MC-02).
7. **GeoPandas**: parches en el CRS de la grilla para medir áreas; GeoJSON publicado en EPSG:4326 (WGS 84).
8. **Fechas** como `datetime` con zona UTC (RN-07).

## Escribir un COG sin pérdida (RNF-09, PS-02)

Con rasterio, usando el driver `COG` de GDAL (las opciones se pasan tal cual a GDAL):

```python
profile = {
    "driver": "COG", "dtype": "float32", "count": 1, "crs": crs, "transform": transform,
    "width": w, "height": h, "nodata": float("nan"),
    "compress": "DEFLATE", "predictor": "YES",  # YES = predictor de punto flotante para float32
    "blocksize": 512,
}
with rasterio.open(ruta, "w", **profile) as dst:
    dst.write(arr.astype("float32"), 1)
```

- `COMPRESS=DEFLATE` o `ZSTD`: sin pérdida. **Nunca** `JPEG`, `WEBP` ni `LERC` con error > 0 en datos de
  análisis.
- Si el driver `COG` no acepta escribir directamente en tu versión, escribe un GTiff temporal y conviértelo con
  `rasterio.shutil.copy(tmp, ruta, driver="COG", compress="DEFLATE", predictor="YES")`.
- Las vistas WebP de 8 bits para el mapa se generan aparte y nunca se usan para calcular (§22).

## Pruebas con pytest (PS-01, PS-02)

- **Datos sintéticos** de pocos píxeles hechos a mano, con el valor esperado calculado a mano (no con la misma
  función que se prueba).
- Casos mínimos por función: valor típico, un `NaN`, un 0 o negativo, todas las fechas sin dato, y el caso de
  menos de 3 fechas previas.
- Ejemplo:

```python
def test_mediana_ignora_nan_y_no_lo_convierte_en_cero():
    pila = np.array([[[1.0]], [[np.nan]], [[3.0]], [[5.0]]], dtype="float32")  # 4 fechas, 1 píxel
    assert linea_base(pila)[0, 0] == pytest.approx(3.0)

def test_cociente_hv_en_db_usa_lineal_antes_de_convertir():
    assert cambio_hv(np.float32(0.05), np.float32(0.1)) == pytest.approx(-3.0103, abs=1e-3)
```

- **PS-02**: escribe un COG en `tmp_path`, reléelo y compara con `np.testing.assert_array_equal` (igualdad
  exacta, `NaN` incluido con `equal_nan=True` si usas `np.array_equal`).
- Las pruebas no descargan datos ni leen `.netrc`.

## Checklist

- [ ] Ningún promedio sobre dB; dB solo al final.
- [ ] `NaN` preservado de punta a punta; ningún `fillna(0)` ni `nodata=0`.
- [ ] Grilla verificada antes de apilar; nada remuestreado en el análisis.
- [ ] COG float32 con DEFLATE o ZSTD y predictor; prueba de igualdad exacta.
- [ ] Funciones puras con pruebas de datos sintéticos y docstring con su MC.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). Open source software packages** — <https://nisar-docs.asf.alaska.edu/using-open-source/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-08. Paquetes de código abierto para trabajar con NISAR (respalda las herramientas de §18): consúltala al elegir y fijar versiones y cítala en el notebook reproducible.
- **Alaska Satellite Facility (2026). Using NISAR data with GDAL** — <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-09. Lectura y recorte del GCOV con GDAL desde la nube (§17.2, §18, §22): cítala en el código de recorte y extracción de HHHH y HVHV.
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).

<!-- referencias:fin -->
