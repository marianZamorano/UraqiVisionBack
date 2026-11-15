#!/usr/bin/env python
"""00 - Comprueba que el contenedor importa todas las librerías y qué credenciales hay."""
import importlib
import os
import sys

LIBS = ["earthaccess", "h5py", "h5netcdf", "xarray", "rioxarray", "rasterio", "osgeo.gdal", "pyproj",
        "numpy", "pandas", "geopandas", "shapely", "pystac_client", "requests", "yaml", "tqdm",
        "jupyterlab", "matplotlib"]
mal = 0
print(f"python {sys.version.split()[0]}")
for n in LIBS:
    try:
        m = importlib.import_module(n)
        print(f"  ok   {n:14s} {getattr(m, '__version__', '')}")
    except Exception as e:  # noqa: BLE001
        mal += 1
        print(f"  MAL  {n:14s} {type(e).__name__}: {e}")
import rasterio
with rasterio.Env() as env:
    tiene_cog = "COG" in env.drivers()
print("  driver COG de GDAL:", "ok" if tiene_cog else "FALTA")
mal += not tiene_cog
for v in ("EARTHDATA_USERNAME", "EARTHDATA_PASSWORD", "FIRMS_MAP_KEY"):
    print(f"  {v}: {'definida' if os.environ.get(v) else 'NO definida'}")   # nunca se imprime el valor
sys.exit(1 if mal else 0)
