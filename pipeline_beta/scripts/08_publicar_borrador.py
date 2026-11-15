#!/usr/bin/env python
"""08 - Genera un BORRADOR de la carpeta publicada de la estación (§17.3) para que el frontend integre.

Escribe publicado/<id>/ con station.json, manifest.json, change.tif, views/, scars.geojson, hectares.csv,
validation.json, quality.json, footprints.geojson, fires.geojson y atlas/departments.geojson.

ES UN BORRADOR EXPLORATORIO: umbrales sin calibrar (MC-03), sin polígonos de control (DP-05), línea base corta
(MC-02). station.json lo declara en "estado". La web debe mostrarlo como tal y nunca como resultado (RN-04).
"""
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio import features
from rasterio.enums import Resampling
from rasterio.warp import reproject
from scipy import ndimage as ndi
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform, unary_union

from _comun import META, RAIZ, RAW, a_fecha, cargar_config, escribir_cog, escribir_json, leer_manifest

VERSION = "0.1.0-borrador"
FACTOR = 3                       # 20 m → 60 m (MC-01)
UMBRALES = {"estricto": -3.0, "central": -2.5, "sensible": -2.0}     # dB, SIN CALIBRAR (MC-03)
CLASES = [  # RN-05: las cuatro clases, siempre candidatas
    ("compatible_quema", "Compatible con quema", "Compatible with burning"),
    ("perdida_previa", "Compatible con pérdida previa de estructura", "Compatible with earlier loss of structure"),
    ("ambigua", "Evidencia ambigua", "Ambiguous evidence"),
    ("insuficiente", "Datos insuficientes", "Insufficient data"),
]


# ------------------------------------------------------------------ utilidades
def sha256(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def db(x):
    return np.where(x > 0, 10 * np.log10(np.where(x > 0, x, 1)), np.nan)


def correlacion(a, b):
    m = np.isfinite(a) & np.isfinite(b)
    return float(np.corrcoef(a[m], b[m])[0, 1]) if m.sum() > 1000 else float("nan")


def version_pipeline() -> str:
    try:
        c = subprocess.run(["git", "-C", str(RAIZ), "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
        return f"{VERSION} (git {c.stdout.strip() or 'sin git'})"
    except OSError:
        return VERSION


def main() -> None:
    cfg = cargar_config()
    nombre = cfg["nombre"]
    est_id = nombre.lower()
    sal = RAIZ / "publicado" / est_id
    if sal.exists():
        shutil.rmtree(sal)
    (sal / "views").mkdir(parents=True)
    (sal / "atlas").mkdir()
    man = leer_manifest()
    hueco = (pd.Timestamp(cfg["periodo"]["hueco"]["inicio"]), pd.Timestamp(cfg["periodo"]["hueco"]["fin"]))

    # -------------------------------------------------------------- serie: frame y fechas (MC-01, RN-01, RN-02)
    nis = pd.DataFrame([v for v in man["nisar"].values() if v.get("estado") == "ok"])
    prov = nis[nis["coleccion"] == "provisional"]
    ver = pd.read_csv(META / "verificacion.csv", dtype={"fecha": str, "frame": str, "track": str})
    # el frame con más píxeles válidos en promedio cubre la caja: es el de la serie principal
    vh = ver[(ver["capa"] == "HVHV") & (ver["coleccion"] == "nisar_provisional")]
    frame = int(vh.groupby("frame")["valido_pct"].median().idxmax())
    track, dire = int(prov["track"].iloc[0]), prov["direccion"].iloc[0]
    serie = prov[prov["frame"] == frame].sort_values("fecha")
    fechas = list(serie["fecha"])
    ruta = lambda f, capa: RAW / "nisar_provisional" / f"{nombre}_{f.replace('-', '')}_T{track:03d}{dire}_F{frame:03d}_{capa}.tif"

    def leer(f, capa, factor=FACTOR):
        with rasterio.open(ruta(f, capa)) as ds:
            h, w = ds.height // factor, ds.width // factor
            a = ds.read(1, out_shape=(h, w), resampling=Resampling.average if factor > 1 else Resampling.nearest)
            return a.astype("float32"), ds.transform * ds.transform.scale(ds.width / w, ds.height / h), ds.crs

    # veredicto por fecha: valores (07_verificar) + posición (correlación con una fecha limpia)
    v169 = ver[(ver["frame"] == f"{frame:03d}") & ver["capa"].isin(["HHHH", "HVHV"])]
    def por_valores(f):
        g = v169[v169["fecha"] == f.replace("-", "")]
        if g.empty: return "sin_verificar", "No hay fila en verificacion.csv"
        if (g["p50"] == 0).any(): return "vacia", "Todos los valores son cero"
        if g["notas"].fillna("").str.contains("mediana").any(): return "valores_malos", "Mediana fuera del rango físico de potencia lineal (0,001–1)"
        if g["notas"].fillna("").str.contains("p98").any(): return "valores_malos", "Valores extremos anómalos (p98 muy alto)"
        if g["notas"].fillna("").str.contains("50%").any(): return "cobertura_baja", "Menos del 50 % de píxeles válidos en la caja"
        return "ok", ""
    previo = {f: por_valores(f) for f in fechas}
    candidatas = [f for f in fechas if previo[f][0] == "ok"]
    pila = {f: leer(f, "HVHV", 6)[0] for f in candidatas}
    ref = max(candidatas, key=lambda f: np.nanmedian([correlacion(np.clip(db(pila[f]), -25, -5), np.clip(db(pila[g]), -25, -5)) for g in candidatas]))
    estado_f = {}
    for f in fechas:
        e, m = previo[f]
        r = correlacion(np.clip(db(pila[ref]), -25, -5), np.clip(db(pila[f]), -25, -5)) if f in pila else float("nan")
        if e == "ok" and r < 0.5:
            e, m = "desplazada", f"No coincide con el paisaje de {ref} (correlación {r:.2f}); georreferencia sospechosa"
        estado_f[f] = {"estado": e, "motivo": m or None, "correlacion_ref": None if np.isnan(r) else round(r, 3)}
    buenas = [f for f in fechas if estado_f[f]["estado"] == "ok"]
    antes_h = [f for f in buenas if pd.Timestamp(f) < hueco[0]]
    base = antes_h if len(antes_h) >= 3 else buenas[:2]
    objetivo = [f for f in buenas if f not in base and pd.Timestamp(f) > pd.Timestamp(base[-1])]
    if len(objetivo) < 2:
        raise SystemExit(f"Solo hay {len(objetivo)} fechas objetivo: no se puede detectar con confirmación.")
    print(f"Frame {frame}, referencia {ref}; buenas {buenas}; línea base {base}; objetivo {objetivo}")

    # -------------------------------------------------------------- análisis (MC-02, MC-03, MC-05 sustituto)
    hv = {f: leer(f, "HVHV")[0] for f in buenas}
    hh_ref, tr, crs = leer(ref, "HHHH")
    shape_ = hh_ref.shape
    def valido60(f):
        with rasterio.open(ruta(f, "mask")) as ds:
            m = ds.read(1)
        h, w = shape_
        return (m[: h * FACTOR, : w * FACTOR] == 1).reshape(h, FACTOR, w, FACTOR).all(axis=(1, 3))
    valido = np.logical_and.reduce([valido60(f) & np.isfinite(hv[f]) & (hv[f] > 0) for f in buenas])
    lb = np.where(valido, np.median(np.stack([hv[f] for f in base]), axis=0), np.nan)
    lb_db = db(lb)
    veg = valido & (lb_db >= np.nanmedian(lb_db))
    rel, deriva = {}, {}
    for f in buenas:
        b = np.where(valido, db(hv[f]) - lb_db, np.nan)
        deriva[f] = float(np.nanmedian(b[veg])); rel[f] = b - deriva[f]
    ha_px = abs(tr.a * tr.e) / 1e4
    min_px = int(np.ceil(1 / ha_px))
    cruz, ocho = ndi.generate_binary_structure(2, 1), np.ones((3, 3), bool)

    def limpiar(m):
        m = ndi.binary_opening(m, structure=cruz)
        e, n = ndi.label(m, structure=ocho)
        if n == 0: return m
        t = ndi.sum(m, e, index=np.arange(1, n + 1))
        return np.isin(e, np.flatnonzero(t >= min_px) + 1)

    def detectar(u):
        p = np.full(shape_, -1)
        for i, f in enumerate(objetivo):
            d = rel[f] < u
            if i < len(objetivo) - 1: d &= rel[objetivo[i + 1]] < u / 2
            d = limpiar(np.nan_to_num(d, nan=0).astype(bool))
            p[(p < 0) & d] = i
        return p
    prim = {k: detectar(u) for k, u in UMBRALES.items()}

    # -------------------------------------------------------------- focos FIRMS (MC-04)
    a_utm = Transformer.from_crs(4326, crs, always_xy=True)
    a_geo = Transformer.from_crs(crs, 4326, always_xy=True)
    fi = pd.read_csv(RAW / "firms" / f"{nombre}_2026.csv", parse_dates=["acq_date"])
    fi["x"], fi["y"] = a_utm.transform(fi["longitude"].values, fi["latitude"].values)
    fi["col"] = ((fi["x"] - tr.c) / tr.a).astype(int); fi["fil"] = ((fi["y"] - tr.f) / tr.e).astype(int)

    # -------------------------------------------------------------- parches y clases (MC-06) con el umbral sensible
    etq, n = ndi.label(prim["sensible"] >= 0, structure=ocho)
    dist, (ir, ic) = ndi.distance_transform_edt(etq == 0, return_indices=True)
    dentro = fi[fi["fil"].between(0, shape_[0] - 1) & fi["col"].between(0, shape_[1] - 1)].copy()
    f_, c_ = dentro["fil"].values, dentro["col"].values
    dentro["parche"] = np.where(dist[f_, c_] <= 6, etq[ir[f_, c_], ic[f_, c_]], 0)
    borde = ndi.binary_dilation(~valido, structure=ocho, iterations=2)
    inicio = [pd.Timestamp(base[-1])] + [pd.Timestamp(f) for f in objetivo[:-1]]
    feats, a_geo_fn = [], (lambda x, y, z=None: a_geo.transform(x, y))
    polis = {}
    for geom, val in features.shapes(etq.astype("int32"), mask=etq > 0, transform=tr, connectivity=8):
        polis.setdefault(int(val), []).append(shape(geom))
    for pid, ps in polis.items():
        m = etq == pid
        i = int(np.bincount(prim["sensible"][m]).argmax())
        fd = dentro.loc[dentro["parche"] == pid, "acq_date"]
        t0, t1 = inicio[i], pd.Timestamp(objetivo[i])
        nd, ns = int(((fd > t0) & (fd <= t1)).sum()), int((fd > t1).sum())
        if i == len(objetivo) - 1 or (m & borde).any():
            k = 3; mot = "Detectado solo en la última fecha (sin confirmar)" if i == len(objetivo) - 1 else "Toca el borde sin dato"
        elif nd > 0: k, mot = 0, f"{nd} focos a ≤360 m durante el intervalo de la caída de HV"
        elif ns > 0: k, mot = 1, f"Sin focos durante la caída; {ns} focos después"
        else: k, mot = 2, "Caída de HV sin focos durante ni después (puede ser cosecha u otra intervención)"
        pol = unary_union(ps)
        feats.append({"type": "Feature", "geometry": mapping(shp_transform(a_geo_fn, pol)), "properties": {
            "id": pid, "clase": CLASES[k][0], "clase_es": CLASES[k][1], "clase_en": CLASES[k][2], "motivo": mot,
            "fecha_primera_deteccion": objetivo[i], "intervalo_inicio": t0.strftime("%Y-%m-%d"),
            "ha": round(float(m.sum() * ha_px), 2), "caida_hv_db": round(float(np.nanmean(rel[objetivo[i]][m])), 2),
            "focos_durante": nd, "focos_despues": ns,
            "rectangularidad": round(pol.area / pol.minimum_rotated_rectangle.area, 3)}})
    escribir_json(sal / "scars.geojson", {"type": "FeatureCollection", "features": feats})

    # -------------------------------------------------------------- hectares.csv (MC-07, RN-06)
    with open(sal / "hectares.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["fecha", "hectareas", "rango_inferior", "rango_superior", "confirmada", "fuente", "metodo"])
        for i, f in enumerate(objetivo):
            ha = {k: round(float(((p >= 0) & (p <= i)).sum() * ha_px), 1) for k, p in prim.items()}
            w.writerow([f, ha["central"], ha["estricto"], ha["sensible"], "no" if i == len(objetivo) - 1 else "si",
                        "NISAR L2 GCOV PROVISIONAL (NASA/ISRO, ASF)",
                        f"Caída sostenida de HV vs línea base {'+'.join(base)}; umbrales {UMBRALES['estricto']}/{UMBRALES['central']}/{UMBRALES['sensible']} dB sin calibrar"])

    # -------------------------------------------------------------- change.tif (análisis, float32 sin pérdida)
    escribir_cog(sal / "change.tif", rel[objetivo[-1]].astype("float32"), crs, tr, float("nan"),
                 tags={"contenido": f"Cambio de HV (dB) de {objetivo[-1]} respecto de la línea base {'+'.join(base)}, corregido por deriva de escena",
                       "unidades": "dB", "estado": "borrador exploratorio, umbrales sin calibrar"})

    # -------------------------------------------------------------- vistas WebP (solo para mirar, §22)
    h, w_ = shape_
    esquinas_utm = [(tr.c, tr.f), (tr.c + tr.a * w_, tr.f), (tr.c + tr.a * w_, tr.f + tr.e * h), (tr.c, tr.f + tr.e * h)]
    esquinas = [list(map(lambda v: round(v, 6), a_geo.transform(x, y))) for x, y in esquinas_utm]   # NO, NE, SE, SO
    rangos = {"hv": (-21, -9), "hh": (-15, -1), "ratio": (-10, -2)}
    vistas = []
    for f in buenas:
        hh_f = leer(f, "HHHH")[0]
        capas = {"hv": db(hv[f]), "hh": db(hh_f), "ratio": db(hv[f]) - db(hh_f)}
        for k, a in capas.items():
            lo, hi = rangos[k]
            g = np.clip((a - lo) / (hi - lo), 0, 1)
            rgba = np.zeros((h, w_, 4), np.uint8)
            rgba[..., :3] = (np.nan_to_num(g) * 255).astype(np.uint8)[..., None]
            rgba[..., 3] = np.where(np.isfinite(a) & valido, 255, 0)            # sin dato = transparente
            nombre_v = f"{f.replace('-', '')}_{k}.webp"
            Image.fromarray(rgba, "RGBA").save(sal / "views" / nombre_v, "WEBP", lossless=False, quality=85)
            vistas.append({"archivo": f"views/{nombre_v}", "fecha": f, "capa": k, "rango_db": [lo, hi]})
    escribir_json(sal / "views" / "index.json", {
        "esquinas_lonlat": esquinas, "orden_esquinas": ["noroeste", "noreste", "sureste", "suroeste"],
        "nota": "Imágenes en la grilla UTM del radar; usar las 4 esquinas (p. ej. fuente 'image' de MapLibre). Escala de grises lineal en dB entre rango_db. Píxel transparente = sin dato válido (RN-13).",
        "vistas": vistas})

    # -------------------------------------------------------------- footprints, focos, departamentos
    hu = json.load(open(META / "nisar_huellas_bolivia.geojson", encoding="utf-8"))
    usadas = set(serie["escena"])
    fp = [ft for ft in hu["features"] if ft["properties"]["escena"] in usadas]
    for ft in fp:
        ft["properties"] = {k: ft["properties"][k] for k in ("escena", "track", "direccion", "frame", "fecha", "polarizacion", "crid")} | \
                           {"estado_en_serie": estado_f.get(ft["properties"]["fecha"], {}).get("estado")}
    escribir_json(sal / "footprints.geojson", {"type": "FeatureCollection", "features": fp})
    fire_feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(r.longitude, 5), round(r.latitude, 5)]},
                   "properties": {"fecha": r.acq_date.strftime("%Y-%m-%d"), "hora_utc": f"{int(r.acq_time):04d}", "sensor": r.fuente,
                                  "frp": None if pd.isna(r.frp) else float(r.frp)}} for r in fi.itertuples()]
    escribir_json(sal / "fires.geojson", {"type": "FeatureCollection", "fuente": "NASA FIRMS (VIIRS S-NPP, VIIRS NOAA-20, MODIS)", "features": fire_feats})
    dep = json.load(open(RAW / "boundaries" / "bolivia_adm1.geojson", encoding="utf-8"))
    lim = man.get("limites", {}).get("bolivia_adm1", {})
    dep["metadatos"] = {"fuente": "geoBoundaries ADM1 (" + lim.get("fuente", "") + ")", "licencia": lim.get("licencia"), "anio": lim.get("anio"), "url": lim.get("url")}
    escribir_json(sal / "atlas" / "departments.geojson", dep)

    # -------------------------------------------------------------- validation.json (VC-01, VC-02)
    s2 = man["sentinel2"]
    def nbr(cual):
        r = s2[cual]["rutas"]; o = {}
        for b in ("nir08", "swir22", "scl"):
            with rasterio.open(RAIZ / r[b]) as ds: o[b] = ds.read(1).astype("float32"); o["tr"], o["crs"] = ds.transform, ds.crs
        ok = np.isin(o["scl"], [4, 5, 6, 7, 11]) & (o["nir08"] > 0)
        n_ = np.where(ok, (o["nir08"] - o["swir22"]) / np.maximum(o["nir08"] + o["swir22"], 1), np.nan)
        out = np.full(shape_, np.nan, np.float32)
        reproject(n_, out, src_transform=o["tr"], src_crs=o["crs"], src_nodata=np.nan, dst_transform=tr, dst_crs=crs, dst_nodata=np.nan, resampling=Resampling.average)
        return out
    dnbr = nbr("antes") - nbr("despues")
    radar = prim["sensible"] >= 0
    met = []
    for u in (0.27, 0.44):
        op = dnbr > u; m = np.isfinite(dnbr) & valido
        vp, fp_, fn = int((radar & op & m).sum()), int((radar & ~op & m).sum()), int((~radar & op & m).sum())
        met.append({"referencia": f"dNBR > {u}", "precision": round(vp / max(vp + fp_, 1), 3), "exhaustividad": round(vp / max(vp + fn, 1), 3),
                    "dice": round(2 * vp / max(2 * vp + fp_ + fn, 1), 3)})
    en_p = dentro[(dentro["acq_date"] > pd.Timestamp(base[-1])) & (dentro["acq_date"] <= pd.Timestamp(objetivo[-1]))]
    escribir_json(sal / "validation.json", {
        "validacion_limitada": True,
        "motivo_es": f"El par óptico ({s2['antes']['fecha']} → {s2['despues']['fecha']}) no coincide con el periodo del radar ({base[-1]} → {objetivo[-1]}); el dNBR incluye la caída de hojas estacional; umbrales sin calibrar.",
        "motivo_en": f"The optical pair ({s2['antes']['fecha']} → {s2['despues']['fecha']}) does not match the radar period ({base[-1]} → {objetivo[-1]}); dNBR includes seasonal leaf fall; thresholds are uncalibrated.",
        "vc01_sentinel2": {"fechas": [s2["antes"]["fecha"], s2["despues"]["fecha"]], "metricas": met,
                           "referencia_literatura": "Belenguer-Plomer et al. (2019): Dice 0,59 en banda C"},
        "vc02_focos": {"parches_con_foco": sum(1 for f_ in feats if f_["properties"]["focos_durante"] + f_["properties"]["focos_despues"] > 0),
                       "parches_total": len(feats), "focos_periodo": int(len(en_p)), "focos_en_o_junto_a_parche": int((en_p["parche"] > 0).sum())},
        "vc03_zonas_control": None, "vc03_motivo": "Polígonos de control sin elegir (DP-05)",
        "vc05_revision_visual": None, "vc05_motivo": "Pendiente de registrar en el notebook"})

    # -------------------------------------------------------------- quality.json (CQ-01 a CQ-06)
    crss, tams = set(), set()
    for f in fechas:
        with rasterio.open(ruta(f, "HVHV")) as ds: crss.add(str(ds.crs)); tams.add((ds.width, ds.height, ds.transform.c, ds.transform.f))
    excl = [{"fecha": f, **estado_f[f]} for f in fechas if estado_f[f]["estado"] != "ok"]
    granulos, sin_sum = [], []
    for _, r in serie.iterrows():
        archivos = {c: {"ruta": p, "sha256": sha256(RAIZ / p)} for c, p in r["rutas"].items()}
        granulos.append({"escena": r["escena"], "fecha": r["fecha"], "track": int(r["track"]), "direccion": r["direccion"], "frame": int(r["frame"]),
                         "polarizacion": r["polarizacion"], "coleccion": r["coleccion"], "crid": r["crid"], "epsg": int(r["epsg"]),
                         "sha256_granulo": None, "recortes": archivos, "estado_en_serie": estado_f[r["fecha"]]["estado"]})
    escribir_json(sal / "quality.json", {
        "CQ-01_geometria": {"ok": bool(len(crss) == 1 and len(tams) == 1), "crs": sorted(crss), "grillas_distintas": len(tams)},
        "CQ-02_orbita": {"ok": bool(serie["track"].nunique() == 1 and serie["direccion"].nunique() == 1), "track": track, "direccion": dire, "frame": frame,
                          "separacion_dias": [int((pd.Timestamp(b) - pd.Timestamp(a)).days) for a, b in zip(fechas, fechas[1:])]},
        "CQ-03_radiometria": {"ok": True, "producto": "GCOV gamma-cero, potencia lineal", "fechas_excluidas": excl},
        "CQ-04_polarizaciones": {"ok": bool(serie["polarizacion"].eq("DHDH").all()), "nota": "Todas las fechas de la serie son DHDH (HH y HV)"},
        "CQ-05_datos_validos": {"pct_valido": round(100 * float(valido.mean()), 1), "limitada": bool(valido.mean() < 0.8)},
        "CQ-06_procedencia": {"ok": False, "motivo": "Hay sha256 de cada recorte, pero no la suma de verificación del gránulo original de ASF",
                              "version_pipeline": version_pipeline()},
        "deriva_escena_db": {f: round(v, 3) for f, v in deriva.items()},
        "generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")})
    escribir_json(sal / "manifest.json", {"estacion": est_id, "version_pipeline": version_pipeline(),
                                           "serie_principal": {"coleccion": "provisional", "crid": sorted(serie["crid"].unique()), "track": track, "direccion": dire, "frame": frame},
                                           "granulos": granulos,
                                           "otros": {"sentinel2": {k: {"fecha": v["fecha"], "ids": v["ids"]} for k, v in s2.items()},
                                                     "firms": {k: {kk: v[kk] for kk in ("desde", "hasta", "focos_caja")} for k, v in man["firms"].items()}},
                                           "licencia_datos_derivados": "CC BY 4.0"})

    # -------------------------------------------------------------- station.json
    W, S, E, N = (cfg["caja"][k] for k in ("oeste", "sur", "este", "norte"))
    est = cfg.get("estacion", {})          # textos bilingües de la estación (config/aoi.yaml → estacion)
    tot = {k: sum(f_["properties"]["ha"] for f_ in feats if f_["properties"]["clase"] == k) for k, *_ in CLASES}
    escribir_json(sal / "station.json", {
        "id": est_id, "estado": "borrador_exploratorio",
        "aviso": {"es": "Borrador exploratorio: umbrales sin calibrar y sin zonas de control. No son resultados (RN-04).",
                  "en": "Exploratory draft: uncalibrated thresholds and no control zones. These are not results (RN-04)."},
        "nombre": est.get("nombre", {"es": nombre, "en": nombre}),
        "departamento": "Santa Cruz",
        "area": {"bbox_lonlat": [W, S, E, N], "criterio": est.get("criterio", {"es": cfg["descripcion"], "en": cfg["descripcion"]})},
        "orbita": {"track": track, "direccion": dire, "frame": frame, "coleccion": "PROVISIONAL", "crid": sorted(serie["crid"].unique())},
        "fechas": [{"fecha": f, **estado_f[f], "rol": "linea_base" if f in base else "objetivo" if f in objetivo else None} for f in fechas],
        "hueco_datos": [cfg["periodo"]["hueco"]["inicio"], cfg["periodo"]["hueco"]["fin"]],
        "resumen_clases_ha": [{"clase": k, "es": es, "en": en, "ha": round(tot[k], 1)} for k, es, en in CLASES],
        "hipotesis": [{"es": "Las áreas quemadas muestran una caída sostenida de HV mayor que la variación estacional del bosque seco sin quemar.",
                       "en": "Burned areas show a sustained HV drop larger than the seasonal variation of unburned dry forest.",
                       "fuente": "Belenguer-Plomer et al. (2019), banda C; la extensión a banda L es propuesta del equipo (§11.1)"},
                      {"es": "En un desmonte, HV cae primero y los focos llegan semanas después; en un incendio llegan juntos.",
                       "en": "In clearing, HV drops first and hotspots arrive weeks later; in a fire they arrive together.",
                       "fuente": "Documento maestro §11.2 (hipótesis del equipo)"}],
        "relato_local": None, "relato_local_motivo": "Lo redacta el equipo (RF-13); no se inventa",
        "preguntas_sugeridas": None, "preguntas_sugeridas_motivo": "Las redacta M-ATLAS (RF-17)",
        "archivos": ["manifest.json", "change.tif", "views/index.json", "scars.geojson", "hectares.csv", "validation.json",
                     "quality.json", "footprints.geojson", "fires.geojson", "atlas/departments.geojson"]})
    pesos = sum(p.stat().st_size for p in (sal / "views").glob("*.webp")) / 1e6
    print(f"Publicado en {sal.relative_to(RAIZ)}: {len(feats)} parches, vistas {pesos:.1f} MB (límite 40 MB, RNF-02)")


if __name__ == "__main__":
    main()
