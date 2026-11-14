#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["earthaccess", "h5py", "numpy", "pyproj", "rasterio", "matplotlib"]
# ///
"""Recorte exploratorio de HH y HV de un gránulo NISAR L2 GCOV, leído desde la nube sin descargarlo (#60; MC-01).

Apoyo a Alex en M-INGESTA. Lee solo los bloques del recuadro (h5py sobre HTTPS con earthaccess), conserva la grilla
del producto sin remuestrear (RN-01), guarda HH y HV en potencia lineal float32 como COG sin pérdida (RNF-09) con
NaN como sin dato (RN-13), la máscara del producto sin interpretar (DP-03) y una vista previa de HV en dB solo para
mirar (§12: dB después). Exploratorio: el recuadro es provisional (DP-08) y nada de esto es un resultado (RN-04).

Credenciales: Earthdata Login desde el .netrc de la persona (fuera del repo); el script nunca las lee ni las imprime
(RNF-06).

Referencias (§31): Alaska Satellite Facility. (2026). NISAR data user guide. https://nisar-docs.asf.alaska.edu/ ·
Alaska Satellite Facility. (2026). Using NISAR data with GDAL. https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal ·
GDAL/OGR contributors. (2026). COG: Cloud Optimized GeoTIFF generator. https://gdal.org/drivers/raster/cog.html

Uso (con uv, que instala las dependencias en un entorno temporal):
  uv run scripts/nisar_recorte.py --granulo NISAR_L2_PR_GCOV_034_060_A_170_..._001 --madurez VALIDATED
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from exploracion.nisar import (
    BBOX_EXPLORATORIO, COLECCIONES, RUTA_GRILLA, analizar_nombre, indices_recorte, transformacion_geotiff,
)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows (cp1252) no imprime todos los caracteres
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--granulo", required=True, help="nombre del gránulo (columna «granulo» del inventario)")
    p.add_argument("--madurez", choices=sorted(COLECCIONES), required=True)
    p.add_argument("--bbox", default=",".join(map(str, BBOX_EXPLORATORIO)), help="oeste,sur,este,norte (grados)")
    p.add_argument("--salida", default="datos/exploracion/recortes")
    a = p.parse_args()

    import earthaccess
    import h5py
    import numpy as np
    import rasterio
    from pyproj import Transformer
    from rasterio.transform import Affine

    info = analizar_nombre(a.granulo)
    oeste, sur, este, norte = map(float, a.bbox.split(","))

    if not earthaccess.login(strategy="netrc").authenticated:
        print("No se pudo iniciar sesión en Earthdata con el .netrc local.", file=sys.stderr)
        return 1
    encontrados = earthaccess.search_data(concept_id=COLECCIONES[a.madurez], granule_name=a.granulo)
    if len(encontrados) != 1:
        print(f"Se esperaba 1 gránulo y CMR devolvió {len(encontrados)}.", file=sys.stderr)
        return 1

    with h5py.File(earthaccess.open(encontrados)[0], "r") as f:
        g = f[RUTA_GRILLA]
        epsg = int(g["projection"].attrs["epsg_code"])
        x, y = g["xCoordinates"], g["yCoordinates"]
        dx, dy = float(g["xCoordinateSpacing"][()]), float(g["yCoordinateSpacing"][()])
        x0, y0 = float(x[0]), float(y[0])

        a_utm = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        esquinas = [a_utm.transform(lon, lat) for lon in (oeste, este) for lat in (sur, norte)]
        xs, ys = [e[0] for e in esquinas], [e[1] for e in esquinas]
        filas, cols = indices_recorte(x0=x0, dx=dx, nx=x.shape[0], y0=y0, dy=dy, ny=y.shape[0],
                                      xmin=min(xs), xmax=max(xs), ymin=min(ys), ymax=max(ys))

        pols = [p.decode() for p in g["listOfPolarizations"][()]]
        capas = {pol: g[pol + pol][filas, cols].astype("float32") for pol in pols}  # HHHH, HVHV
        mascara = g["mask"][filas, cols]
        transform = Affine(*transformacion_geotiff(
            x_primero=float(x[cols.start]), dx=dx, y_primero=float(y[filas.start]), dy=dy))

    os.makedirs(a.salida, exist_ok=True)
    base = os.path.join(a.salida, f"{info['inicio_utc'][:10]}_{info['orbita']}_{info['crid']}")
    perfil = dict(driver="COG", crs=f"EPSG:{epsg}", transform=transform, compress="DEFLATE",
                  height=mascara.shape[0], width=mascara.shape[1], count=1)

    resumen = {}
    for pol, datos in capas.items():
        with rasterio.open(f"{base}_{pol}_lineal.tif", "w", dtype="float32", nodata=float("nan"), **perfil) as d:
            d.write(datos, 1)
        validos = np.isfinite(datos)
        resumen[pol] = {
            "pixeles": int(datos.size),
            "sin_dato_nan": int((~validos).sum()),
            # RN-13: si no hay píxeles válidos, la mediana no se reporta (None), no es 0.
            "mediana_lineal": float(np.median(datos[validos])) if validos.any() else None,
        }
    with rasterio.open(f"{base}_mascara.tif", "w", dtype="uint8", nodata=255, **perfil) as d:
        d.write(mascara, 1)

    if "HV" in capas:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        hv_db = 10 * np.log10(capas["HV"])  # dB solo para mirar (§12); el COG queda en lineal.
        fig, ax = plt.subplots(figsize=(6, 6))
        im = ax.imshow(hv_db, cmap="gray", vmin=np.nanpercentile(hv_db, 2), vmax=np.nanpercentile(hv_db, 98))
        fig.colorbar(im, ax=ax, label="HV (dB)")
        ax.set_title(f"HV {info['inicio_utc'][:10]} · {info['orbita']} · {a.madurez}\nExploratorio, no es un resultado")
        ax.set_axis_off()
        fig.savefig(f"{base}_HV_vista_dB.png", dpi=120, bbox_inches="tight")
        plt.close(fig)

    procedencia = {
        "granulo": a.granulo, "madurez": a.madurez, "crid": info["crid"], "orbita": info["orbita"],
        "frame": info["frame"], "inicio_utc": info["inicio_utc"], "polarizaciones": pols,
        "bbox_wgs84": [oeste, sur, este, norte], "bbox_es_provisional": True, "epsg": epsg,
        "filas": [filas.start, filas.stop], "columnas": [cols.start, cols.stop], "pixel_m": [dx, dy],
        "capas": resumen, "generado_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aviso": "Exploratorio (#60). No es un resultado de UraqiVision (RN-04).",
    }
    with open(f"{base}_procedencia.json", "w", encoding="utf-8") as fj:
        json.dump(procedencia, fj, ensure_ascii=False, indent=2)

    print(json.dumps(procedencia, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
