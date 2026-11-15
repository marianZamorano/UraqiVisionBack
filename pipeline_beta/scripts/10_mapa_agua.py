#!/usr/bin/env python
"""10 - Mapa de agua «antes» (época seca) para medir inundaciones cuando se publiquen las escenas de lluvias.

EXPLORATORIO y fuera del MVP (§8.2, §27): las inundaciones de la temporada 2026–2027 aún no tienen datos. Este mapa es
la referencia contra la que se compararán.

Método (banda L, NISAR GCOV en potencia lineal, 60 m):
- Fechas sanas: valores en rango (07_verificar) y en su sitio (correlación de HV ≥ 0,5 con la fecha más coherente).
- Agua abierta: HH y HV muy oscuros (el agua quieta refleja el pulso lejos del sensor). El umbral de HH sale de los
  datos con Otsu sobre todas las fechas juntas, acotado a [−24, −14] dB; HV debe estar además bajo su percentil 5.
- Frecuencia de agua = fracción de fechas sanas con agua. ≥ 0,8 permanente; 0,2–0,8 ocasional.
- Doble rebote fuerte (HH mucho más brillante que HV, HH − HV ≥ 10 dB y HH ≥ −6 dB): puede ser bosque inundado, pero
  también techos o estructuras. Solo contexto, nunca «inundación».

Escribe publicado/<nombre>_agua/: agua_frecuencia.tif (COG float32), doble_rebote_frecuencia.tif, agua.webp,
resumen.json y vista_control.png (revisión visual).
"""
from __future__ import annotations

import glob
import json
import shutil

import numpy as np
import pandas as pd
import rasterio
from PIL import Image
from rasterio.enums import Resampling

from _comun import META, RAIZ, RAW, cargar_config, escribir_cog, escribir_json

FACTOR = 3


def db(x):
    return np.where(x > 0, 10 * np.log10(np.where(x > 0, x, 1)), np.nan)


def otsu(v: np.ndarray, bins: int = 256) -> float:
    h, bordes = np.histogram(v, bins=bins)
    centros = (bordes[:-1] + bordes[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0
    m0 = np.cumsum(h * centros) / np.maximum(w0, 1)
    m1 = (np.sum(h * centros) - np.cumsum(h * centros)) / np.maximum(w1, 1)
    return float(centros[np.argmax(w0 * w1 * (m0 - m1) ** 2)])


def main() -> None:
    cfg = cargar_config()
    nombre = cfg["nombre"]
    sal = RAIZ / "publicado" / f"{nombre.lower()}_agua"
    if sal.exists():
        shutil.rmtree(sal)
    sal.mkdir(parents=True)

    ver = pd.read_csv(META / "verificacion.csv", dtype=str)
    v = ver[(ver.coleccion == "nisar_provisional") & (ver.capa == "HVHV")].copy()
    v["valido_pct"] = v.valido_pct.astype(float)
    frame = v.groupby("frame").valido_pct.median().idxmax()
    v = v[v.frame == frame].sort_values("fecha")

    def leer(f, capa):
        p = glob.glob(str(RAW / "nisar_provisional" / f"{nombre}_{f}_T*_F{frame}_{capa}.tif"))[0]
        with rasterio.open(p) as ds:
            h, w = ds.height // FACTOR, ds.width // FACTOR
            a = ds.read(1, out_shape=(h, w), resampling=Resampling.average if capa != "mask" else Resampling.nearest)
            return a.astype("float32"), ds.transform * ds.transform.scale(ds.width / w, ds.height / h), ds.crs

    hv = {f: leer(f, "HVHV")[0] for f in v.fecha}
    forma = pd.Series({f: a.shape for f, a in hv.items()}).mode()[0]
    ok_val = [f for f in v.fecha if v[v.fecha == f].estado.iloc[0] == "ok" and hv[f].shape == forma]

    def corr(a, b):
        x, y = np.clip(db(a), -25, -5), np.clip(db(b), -25, -5); m = np.isfinite(x) & np.isfinite(y)
        return float(np.corrcoef(x[m], y[m])[0, 1]) if m.sum() > 1000 else np.nan
    ref = max(ok_val, key=lambda f: np.nanmedian([corr(hv[f], hv[g]) for g in ok_val if g != f]))
    sanas = [f for f in ok_val if corr(hv[ref], hv[f]) >= 0.5]
    _, tr, crs = leer(ref, "HVHV")

    hh_db = {f: db(leer(f, "HHHH")[0]) for f in sanas}
    hv_db = {f: db(hv[f]) for f in sanas}
    validos = {f: (leer(f, "mask")[0] == 1) & np.isfinite(hh_db[f]) & np.isfinite(hv_db[f]) for f in sanas}
    todo_hh = np.concatenate([hh_db[f][validos[f]] for f in sanas])
    t_hh = float(np.clip(otsu(np.clip(todo_hh, -35, 5)), -24, -14))
    t_hv = float(np.percentile(np.concatenate([hv_db[f][validos[f]] for f in sanas]), 5))

    agua = {f: validos[f] & (hh_db[f] < t_hh) & (hv_db[f] < t_hv) for f in sanas}
    rebote = {f: validos[f] & (hh_db[f] - hv_db[f] >= 10) & (hh_db[f] >= -6) for f in sanas}
    n_val = np.sum([validos[f] for f in sanas], axis=0)
    con_dato = n_val > 0
    frec = np.where(con_dato, np.sum([agua[f] for f in sanas], axis=0) / np.maximum(n_val, 1), np.nan).astype("float32")
    frec_rb = np.where(con_dato, np.sum([rebote[f] for f in sanas], axis=0) / np.maximum(n_val, 1), np.nan).astype("float32")
    ha_px = abs(tr.a * tr.e) / 1e4

    escribir_cog(sal / "agua_frecuencia.tif", frec, crs, tr, float("nan"),
                 tags={"contenido": "fracción de fechas sanas con agua abierta (época seca)", "fechas": ",".join(sanas)})
    escribir_cog(sal / "doble_rebote_frecuencia.tif", frec_rb, crs, tr, float("nan"),
                 tags={"contenido": "fracción de fechas con doble rebote fuerte (posible bosque inundado o estructuras)"})

    # Vista: azul oscuro = agua permanente, celeste = ocasional, violeta = doble rebote frecuente, gris = HV de fondo.
    fondo = np.clip((np.nanmedian(np.stack([hv_db[f] for f in sanas]), axis=0) + 21) / 12, 0, 1)
    rgb = (np.nan_to_num(fondo)[..., None] * np.array([235, 235, 235]) + 20).astype(np.uint8)
    rgb[frec_rb >= 0.5] = (128, 63, 160)
    rgb[(frec >= 0.2) & (frec < 0.8)] = (120, 190, 235)
    rgb[frec >= 0.8] = (16, 72, 150)
    alfa = np.where(con_dato, 255, 0).astype(np.uint8)
    Image.fromarray(np.dstack([rgb, alfa]), "RGBA").save(sal / "agua.webp", "WEBP", quality=85)
    # Capa para superponer en el mapa de la web: solo las clases de agua, el resto transparente.
    capa = np.zeros(frec.shape + (4,), np.uint8)
    for sel, color, a_ in (((frec >= 0.2) & (frec < 0.8), (120, 190, 235), 220), (frec >= 0.8, (16, 72, 150), 235)):
        capa[sel] = (*color, a_)
    Image.fromarray(capa, "RGBA").save(sal / "agua_capa.webp", "WEBP", lossless=True)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ejes = plt.subplots(1, 2, figsize=(14, 7))
    ejes[0].imshow(np.nanmedian(np.stack([hh_db[f] for f in sanas]), axis=0), cmap="gray", vmin=-25, vmax=-3)
    ejes[0].set_title(f"{nombre}: HH mediana de {len(sanas)} fechas sanas (dB)")
    ejes[1].imshow(np.dstack([rgb, alfa]))
    ejes[1].set_title(f"Agua permanente (azul) · ocasional (celeste) · doble rebote (violeta) · umbral HH {t_hh:.1f} dB")
    for a in ejes: a.set_xticks([]); a.set_yticks([])
    fig.savefig(sal / "vista_control.png", dpi=90, bbox_inches="tight"); plt.close(fig)

    from pyproj import Transformer
    a_geo = Transformer.from_crs(crs, 4326, always_xy=True)
    h, w = frec.shape
    esquinas = [list(map(lambda x: round(x, 6), a_geo.transform(x, y))) for x, y in
                [(tr.c, tr.f), (tr.c + tr.a * w, tr.f), (tr.c + tr.a * w, tr.f + tr.e * h), (tr.c, tr.f + tr.e * h)]]
    escribir_json(sal / "resumen.json", {
        "estado": "exploratorio, fuera del MVP (§8.2); referencia de época seca para inundaciones",
        "id": f"{nombre.lower()}_agua",
        "nombre": cfg.get("estacion", {}).get("nombre", {"es": nombre, "en": nombre}),
        "capa": "agua_capa.webp",
        "zona": cfg["descripcion"], "frame": int(frame), "fechas_sanas": sanas,
        "fechas_excluidas": [f for f in v.fecha if f not in sanas],
        "umbral_hh_db": round(t_hh, 2), "umbral_hv_db": round(t_hv, 2), "metodo_umbral": "Otsu sobre HH de todas las fechas, acotado a [−24, −14] dB",
        "ha_agua_permanente": round(float((frec >= 0.8).sum() * ha_px), 1),
        "ha_agua_ocasional": round(float(((frec >= 0.2) & (frec < 0.8)).sum() * ha_px), 1),
        "ha_doble_rebote_frecuente": round(float((frec_rb >= 0.5).sum() * ha_px), 1),
        "ha_agua_por_fecha": {f: round(float(agua[f].sum() * ha_px), 1) for f in sanas},
        "pct_con_dato": round(100 * float(con_dato.mean()), 1),
        "esquinas_lonlat": esquinas,
        "limites": ["Agua quieta y suelo muy liso o sombra de radar se ven igual de oscuros",
                    "El doble rebote también aparece en techos y estructuras, no solo en bosque inundado",
                    "Época seca: no hay ninguna inundación en estas fechas; es la referencia del «antes»",
                    "Producto PROVISIONAL; falta revisión visual"]})
    print(f"Mapa de agua en {sal.relative_to(RAIZ)}: {len(sanas)} fechas, umbral HH {t_hh:.1f} dB, "
          f"agua permanente {(frec >= 0.8).sum() * ha_px:,.0f} ha")


if __name__ == "__main__":
    main()
