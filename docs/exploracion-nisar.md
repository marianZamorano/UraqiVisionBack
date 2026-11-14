# Exploración de NISAR sobre San Ignacio: guía paso a paso

Issue #60 · Apoyo a Alex en M-INGESTA (MC-01, RF-26) · 14 nov 2026.

Esta guía explica cómo ver qué escenas NISAR hay sobre San Ignacio de Velasco y cómo leer un recorte de HH y HV
directamente desde la nube de la NASA, sin descargar los archivos completos (de 1,4 a 6,9 GB cada uno).

> **Exploratorio.** El recuadro es provisional mientras siga pendiente el recorte de la estación (DP-08), y nada de
> lo que generan estos comandos es un resultado de UraqiVision (RN-04). No reemplaza al plan de `specs/002-ingesta`.

## 1. Requisitos (una vez por computadora)

1. **Python 3.11 o superior** y **[uv](https://docs.astral.sh/uv/)**. `uv` instala las dependencias del recorte en
   un entorno temporal: no hay que instalar nada en el proyecto.
2. **El repositorio preparado** como en `ai/README.md` (`npm install`, `npm run hooks:activar`).
3. **Solo para el recorte:** una cuenta gratuita de [Earthdata Login](https://urs.earthdata.nasa.gov/). El
   inventario no la necesita.

## 2. Guardar las credenciales de Earthdata (una vez, solo para el recorte)

Hazlo en **tu propia terminal**, nunca en un chat ni en un archivo del repositorio (RNF-06):

```powershell
uv run --with earthaccess python -c "import earthaccess; earthaccess.login(strategy='interactive', persist=True)"
```

- Pide tu usuario y tu contraseña, y los guarda en `.netrc` (o `_netrc`) dentro de tu carpeta de usuario.
- También puede crear `.dodsrc` y `.urs_cookies` en la carpeta donde lo ejecutes. Están en el `.gitignore` y no se
  suben al repositorio, pero no los compartas.

## 3. Ver qué escenas hay (sin cuenta)

```powershell
npm run nisar:inventario
```

- Consulta el catálogo CMR de la NASA, en las colecciones GCOV PROVISIONAL (`C2854338529-ASF`) y VALIDATED
  (`C3622241360-ASF`). Nunca usa BETA (RN-02).
- Escribe `datos/exploracion/inventario_nisar.csv`, con una fila por escena: madurez, nombre, órbita (por ejemplo
  `060A`), frame, polarizaciones (`HH+HV` o `HH`), CRID, inicio en UTC y en hora de Bolivia (RN-07), tamaño, enlace
  al `.h5`, vista previa y huella WKT (RF-26).
- En la terminal muestra un resumen por madurez, órbita y polarización.

**Opciones:**

```powershell
npm run nisar:inventario -- --bbox -61.2,-16.6,-60.7,-16.1   # otro recuadro: oeste,sur,este,norte
npm run nisar:inventario -- --desde 2026-08-10                # solo escenas desde esa fecha
```

**Cómo leer el resultado:**

- Una misma órbita puede aparecer dos veces en la misma fecha, porque el recuadro cae sobre **dos frames**
  contiguos (por ejemplo, 169 y 170 de la órbita 060A).
- Una escena `HH` (modo `SHSH`) no tiene HV, así que no sirve para la serie de HV (CQ-04).
- Solo se comparan escenas de la **misma órbita** (RN-01).

## 4. Recortar una escena (con cuenta)

1. Elige una escena en el CSV y copia su columna `granulo` y su columna `madurez`.
2. Ejecuta:

```powershell
npm run nisar:recorte -- --granulo NISAR_L2_PR_GCOV_034_060_A_170_2005_DHDH_A_20261028T095118_20261028T095152_P05036_N_F_J_001 --madurez VALIDATED
```

- Lee **solo** la ventana del recuadro de `science/LSAR/GCOV/grids/frequencyA/HHHH` y `HVHV` (unos 20 MB en vez
  de 1,9 GB) y conserva la grilla del producto, sin remuestrear (RN-01).
- La primera vez tarda más, porque `uv` prepara el entorno.
- Acepta también `--bbox` y `--salida`.

**Qué deja en `datos/exploracion/recortes/`** (los nombres empiezan por `<fecha>_<órbita>_<CRID>`):

| Archivo | Qué es |
|---|---|
| `*_HH_lineal.tif`, `*_HV_lineal.tif` | Potencia lineal en float32, COG sin pérdida (RNF-09). Sin dato = NaN, nunca 0 (RN-13). |
| `*_mascara.tif` | La máscara del producto, sin interpretar (el significado de cada valor está pendiente: DP-03). |
| `*_HV_vista_dB.png` | Vista de HV en dB, **solo para mirar** (§12: los cálculos se hacen en lineal). |
| `*_procedencia.json` | Escena, CRID, órbita, recuadro, filas y columnas, píxeles sin dato y mediana por capa. |

**Para abrirlos:** los `.tif` se abren en QGIS (gratuito); la vista `.png`, con cualquier visor de imágenes.

## 5. Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| `No se pudo iniciar sesión en Earthdata` | Repite el paso 2. Comprueba en tu perfil de Earthdata que la cuenta esté activa. |
| `Se esperaba 1 gránulo y CMR devolvió 0` | Revisa que el nombre y la madurez coincidan con el CSV. |
| `El recuadro no se superpone con la escena` | Esa escena no cubre el recuadro: elige otra del inventario. |
| Muchos NaN en `*_procedencia.json` | El recuadro cae en parte en otro frame. Recorta también el frame vecino de la misma fecha. Cómo unirlos lo deciden M-INGESTA y M-CIENCIA. |
| `uv: command not found` | Instala uv (paso 1). |

## 6. Para desarrollar

- Funciones puras en `exploracion/nisar.py` y pruebas en `tests/exploracion/` (`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
  python -m pytest -q tests/exploracion`).
- Hechos verificados el 14 nov 2026 leyendo el HDF5 de una escena VALIDATED: el nombre coincide con
  `science/LSAR/identification`; la grilla es EPSG:32720 con píxel de 20 m y coordenadas en el centro del píxel;
  `_FillValue` es NaN.

## Referencias (§31)

- Alaska Satellite Facility. (2026). *NISAR data user guide*. https://nisar-docs.asf.alaska.edu/
- Alaska Satellite Facility. (2026). *Using NISAR data with GDAL*. https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal
- GDAL/OGR contributors. (2026). *COG: Cloud Optimized GeoTIFF generator*. https://gdal.org/drivers/raster/cog.html
