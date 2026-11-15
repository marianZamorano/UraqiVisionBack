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
from shapely.geometry import box as caja_geom, mapping, shape
from shapely.ops import transform as shp_transform, unary_union

from _comun import META, RAIZ, RAW, a_fecha, cargar_config, escribir_cog, escribir_json, leer_manifest

VERSION = "0.1.0-borrador"
FACTOR = 3                       # 20 m → 60 m (MC-01)
UMBRALES = {"estricto": -3.0, "central": -2.5, "sensible": -2.0}     # dB, de partida; se calibran con las zonas de control (MC-03)
# Decisiones del 14 nov 2026 (acuerdo de M-CIENCIA comunicado por Alex): DP-05 zonas de control automáticas con estos
# criterios; MC-03 umbrales con zonas de control y dNBR (falsa alarma ≤ 2 / 1 / 0,5 % sin cambio óptico); MC-02 línea base de 2 fechas
# (desviación declarada: no hay 3 fechas sanas antes del evento en la órbita 060A).
DECISIONES = {"fecha": "2026-11-14", "aprobado": "M-CIENCIA (Tabata), acuerdo comunicado por Alex (M-INGESTA)",
              "DP-05": "zonas de control automáticas (criterios en control_propuesta.json)",
              "MC-03": "umbrales calibrados con zonas de control (deriva) y dNBR: como máximo 2 / 1 / 0,5 % marcado donde Sentinel-2 no ve cambio",
              "MC-02": "línea base de 2 fechas posteriores al hueco; desviación declarada del mínimo de 3"}
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
    est_id = cfg.get("estacion", {}).get("id", nombre.lower())   # id público de la estación (config → estacion.id)
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
    rel, deriva, bruto = {}, {}, {}
    for f in buenas:
        b = np.where(valido, db(hv[f]) - lb_db, np.nan)
        bruto[f] = b                                   # cambio sin corregir: lo usa la propuesta de zonas de control
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

    def detectar(u, r=None):
        r = rel if r is None else r
        p = np.full(shape_, -1)
        for i, f in enumerate(objetivo):
            d = r[f] < u
            if i < len(objetivo) - 1: d &= r[objetivo[i + 1]] < u / 2
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

    # -------------------------------------------------------------- testigo óptico (VC-01)
    s2 = man["sentinel2"]
    # VC-01: si hay un par Sentinel-2 que encierra el periodo del radar, se usa ese; si no, el par de estación seca.
    par_opt = ("antes_radar", "despues_radar") if {"antes_radar", "despues_radar"} <= set(s2) else ("antes", "despues")
    def nbr(cual):
        r = s2[cual]["rutas"]; o = {}
        for b in ("nir08", "swir22", "scl"):
            with rasterio.open(RAIZ / r[b]) as ds: o[b] = ds.read(1).astype("float32"); o["tr"], o["crs"] = ds.transform, ds.crs
        ok = np.isin(o["scl"], [4, 5, 6, 7, 11]) & (o["nir08"] > 0)
        n_ = np.where(ok, (o["nir08"] - o["swir22"]) / np.maximum(o["nir08"] + o["swir22"], 1), np.nan)
        out = np.full(shape_, np.nan, np.float32)
        reproject(n_, out, src_transform=o["tr"], src_crs=o["crs"], src_nodata=np.nan, dst_transform=tr, dst_crs=crs, dst_nodata=np.nan, resampling=Resampling.average)
        return out
    dnbr = nbr(par_opt[0]) - nbr(par_opt[1])

    # -------------------------------------------------------------- zonas de control (MC-05, DP-05) y umbrales calibrados (MC-03)
    # Bloques de ~1 km sin fuego ni cambio óptico, con vegetación parecida a la que cayó: si ahí HV se mueve, ese
    # movimiento es de la estación y se resta (reemplaza al sustituto de la «mitad más vegetada»).
    a_geo_fn = lambda x, y, z=None: a_geo.transform(x, y)
    BLOQUE, paso_m, TOL = 17, abs(tr.a), 1.5                            # 17 × 60 m ≈ 1 km; ±1,5 dB de parecido
    fuego = np.zeros(shape_, bool)
    en_caja = fi["fil"].between(0, shape_[0] - 1) & fi["col"].between(0, shape_[1] - 1)
    fuego[fi.loc[en_caja, "fil"].values, fi.loc[en_caja, "col"].values] = True
    dist_fuego_m = ndi.distance_transform_edt(~fuego) * paso_m          # focos de TODO el periodo descargado
    dist_borde_m = ndi.distance_transform_edt(valido) * paso_m
    etq1, _ = ndi.label(prim["sensible"] >= 0, structure=ocho)          # parches de la primera pasada
    lejos_parche = ~ndi.binary_dilation(etq1 > 0, iterations=BLOQUE)
    ref_hv = float(np.nanmedian(lb_db[etq1 > 0])) if (etq1 > 0).any() else float(np.nanmedian(lb_db[valido]))
    apto = valido & (dist_fuego_m >= 2000) & (dist_borde_m >= 1000) & lejos_parche & np.isfinite(dnbr) & (dnbr < 0.27)
    cand = []
    for i in range(0, shape_[0] - BLOQUE + 1, BLOQUE):
        for j in range(0, shape_[1] - BLOQUE + 1, BLOQUE):
            sl = (slice(i, i + BLOQUE), slice(j, j + BLOQUE))
            if apto[sl].mean() >= 0.9:
                v_ = lb_db[sl][apto[sl]]
                hvb, sd = float(np.nanmedian(v_)), float(np.nanstd(v_))
                if abs(hvb - ref_hv) <= TOL:                            # la mediana del bloque, no cada píxel (speckle)
                    cand.append({"i": i, "j": j, "hv": hvb, "sd": sd})
    n_cumplen = len(cand)
    # Parcelas y campos a rayas tienen textura muy variable: fuera los bloques más heterogéneos (sobre el percentil 75).
    lim_sd = float(np.percentile([c["sd"] for c in cand], 75)) if cand else None
    cand = sorted((c for c in cand if c["sd"] <= lim_sd), key=lambda c: abs(c["hv"] - ref_hv) + 0.25 * c["sd"]) if cand else []
    elegidas, separacion = [], 5000 / paso_m                         # al menos 5 km entre zonas
    for c in cand:
        if all(np.hypot(c["i"] - e_["i"], c["j"] - e_["j"]) >= separacion for e_ in elegidas):
            elegidas.append(c)
        if len(elegidas) == 6:
            break
    ctrl, zonas = np.zeros(shape_, bool), []
    for k, c in enumerate(elegidas, 1):
        sl = (slice(c["i"], c["i"] + BLOQUE), slice(c["j"], c["j"] + BLOQUE))
        ctrl[sl] |= apto[sl]
        x0, y0 = tr * (c["j"], c["i"]); x1, y1 = tr * (c["j"] + BLOQUE, c["i"] + BLOQUE)
        zonas.append({"type": "Feature", "geometry": mapping(shp_transform(a_geo_fn, caja_geom(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))),
                      "properties": {"id": f"C{k}", "ha": round(float(apto[sl].sum() * ha_px), 1), "hv_linea_base_db": round(c["hv"], 2),
                                     "textura_db": round(c["sd"], 2), "dnbr_mediana": round(float(np.nanmedian(dnbr[sl])), 3),
                                     "foco_mas_cercano_km": round(float(dist_fuego_m[sl].min()) / 1000, 1),
                                     "cambio_hv_sin_corregir_db": {f: round(float(np.nanmedian(bruto[f][sl])), 3) for f in buenas}}})
    ha_ult = lambda pr: {k: round(float((pr_ >= 0).sum() * ha_px), 1) for k, pr_ in pr.items()}
    deriva_sustituto, prim_sustituto = dict(deriva), prim
    UMB, calib = dict(UMBRALES), None
    if ctrl.sum() >= 500:                                              # al menos ~180 ha de control
        deriva = {f: float(np.nanmedian(bruto[f][ctrl])) for f in buenas}
        rel = {f: bruto[f] - deriva[f] for f in buenas}                # detectar() lee este `rel`
        # MC-03 «con zonas de control y dNBR»: las zonas de control corrigen la deriva (arriba); el umbral se elige sobre
        # TODA la superficie donde Sentinel-2 no ve cambio (|dNBR| ≤ 0,1, fuera de las zonas de control): es el menos
        # exigente que deja marcada como máximo esa fracción. Las zonas de control solas son demasiado homogéneas.
        sin_cambio_opt = valido & np.isfinite(dnbr) & (np.abs(dnbr) <= 0.1) & ~ctrl
        OBJETIVO_FA = {"sensible": 2.0, "central": 1.0, "estricto": 0.5}      # % máximo marcado donde el óptico no ve cambio
        curva = []
        for u in np.round(np.arange(-1.0, -6.01, -0.1), 2):
            det = detectar(float(u)) >= 0
            curva.append((float(u), 100 * float((det & sin_cambio_opt).sum()) / max(int(sin_cambio_opt.sum()), 1)))
        UMB = {k: next((u for u, fa in curva if fa <= meta), -6.0) for k, meta in OBJETIVO_FA.items()}
        prim = {k: detectar(u) for k, u in UMB.items()}
        calib = {"metodo": "umbral menos exigente que deja marcada como máximo la fracción objetivo de la superficie sin cambio óptico (|dNBR| ≤ 0,1)",
                 "objetivo_falsa_alarma_pct": OBJETIVO_FA, "pixeles_sin_cambio_optico": int(sin_cambio_opt.sum()),
                 "par_optico": [s2[par_opt[0]]["fecha"], s2[par_opt[1]]["fecha"]], "umbrales_db": UMB,
                 "falsa_alarma_sin_cambio_optico_pct": {k: round(100 * float(((p_ >= 0) & sin_cambio_opt).sum()) / max(int(sin_cambio_opt.sum()), 1), 2) for k, p_ in prim.items()},
                 "falsa_alarma_en_control_pct": {k: round(100 * float(((p_ >= 0) & ctrl).sum()) / max(int(ctrl.sum()), 1), 3) for k, p_ in prim.items()},
                 "curva": [{"umbral_db": u, "falsa_alarma_pct": round(fa, 2)} for u, fa in curva]}
    escribir_json(sal / "control_candidatas.geojson", {"type": "FeatureCollection", "features": zonas})
    escribir_json(sal / "control_propuesta.json", {
        "estado": "aplicada" if calib else "sin zonas suficientes: se usa el sustituto",
        "decision": DECISIONES,
        "criterios": {"bloque_m": round(BLOQUE * paso_m), "vegetacion_parecida": f"mediana de HV del bloque a ±{TOL} dB de la que tenía lo que después cayó",
                      "sin_fuego": "sin focos FIRMS a menos de 2 km en todo el periodo descargado",
                      "sin_cambio_optico": "dNBR < 0,27 (sin quema moderada ni severa)", "lejos_de_parches_km": 1, "lejos_del_borde_km": 1,
                      "cobertura_minima": 0.9, "textura_maxima_db": None if lim_sd is None else round(lim_sd, 2),
                      "separacion_km": 5, "orden": "parecido de HV y textura más homogénea"},
        "referencia_hv_db": round(ref_hv, 2), "candidatas_que_cumplen": n_cumplen, "elegidas": len(zonas),
        "deriva_actual_db": {f: round(v, 3) for f, v in deriva_sustituto.items()},
        "deriva_con_control_db": {f: round(v, 3) for f, v in deriva.items()} if calib else None,
        "calibracion": calib,
        "hectareas_ultima_fecha": {"actual": ha_ult(prim_sustituto), "con_control": ha_ult(prim) if calib else None}})

    # -------------------------------------------------------------- parches y clases (MC-06) con el umbral sensible
    etq, n = ndi.label(prim["sensible"] >= 0, structure=ocho)
    dist, (ir, ic) = ndi.distance_transform_edt(etq == 0, return_indices=True)
    dentro = fi[fi["fil"].between(0, shape_[0] - 1) & fi["col"].between(0, shape_[1] - 1)].copy()
    f_, c_ = dentro["fil"].values, dentro["col"].values
    dentro["parche"] = np.where(dist[f_, c_] <= 6, etq[ir[f_, c_], ic[f_, c_]], 0)
    borde = ndi.binary_dilation(~valido, structure=ocho, iterations=2)
    inicio = [pd.Timestamp(base[-1])] + [pd.Timestamp(f) for f in objetivo[:-1]]
    feats = []
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
                        f"Caída sostenida de HV vs línea base {'+'.join(base)}; umbrales {UMB['estricto']}/{UMB['central']}/{UMB['sensible']} dB " + ("calibrados con zonas de control" if calib else "sin calibrar")])

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
    # Tramo VALIDATED (RN-02): misma órbita y frame, pero se muestra APARTE: nunca entra a la línea base, al cambio
    # ni a las hectáreas. Su grilla puede diferir de la PROVISIONAL, así que cada vista lleva sus propias esquinas.
    tramo_val = []
    for g in sorted((x for x in man["nisar"].values() if x.get("estado") == "ok" and x.get("coleccion") == "validated"
                     and int(x["track"]) == track and x["direccion"] == dire and int(x["frame"]) == frame),
                    key=lambda x: x["fecha"]):
        try:
            capas_v = {}
            for c in ("HVHV", "HHHH", "mask"):
                with rasterio.open(RAIZ / g["rutas"][c]) as ds:
                    fac = max(1, round(60 / abs(ds.transform.a)))
                    hv_, wv_ = ds.height // fac, ds.width // fac
                    capas_v[c] = ds.read(1, out_shape=(hv_, wv_), resampling=Resampling.nearest if c == "mask" else Resampling.average).astype("float32")
                    trv = ds.transform * ds.transform.scale(ds.width / wv_, ds.height / hv_); crs_v = ds.crs
            a_geo_v = Transformer.from_crs(crs_v, 4326, always_xy=True)
            esq_v = [list(map(lambda q: round(q, 6), a_geo_v.transform(x, y))) for x, y in
                     [(trv.c, trv.f), (trv.c + trv.a * wv_, trv.f), (trv.c + trv.a * wv_, trv.f + trv.e * hv_), (trv.c, trv.f + trv.e * hv_)]]
            ok_v = capas_v["mask"] == 1
            for k, a in {"hv": db(capas_v["HVHV"]), "hh": db(capas_v["HHHH"]), "ratio": db(capas_v["HVHV"]) - db(capas_v["HHHH"])}.items():
                lo, hi = rangos[k]
                gr = np.clip((a - lo) / (hi - lo), 0, 1)
                rgba = np.zeros((hv_, wv_, 4), np.uint8)
                rgba[..., :3] = (np.nan_to_num(gr) * 255).astype(np.uint8)[..., None]
                rgba[..., 3] = np.where(np.isfinite(a) & ok_v, 255, 0)
                nombre_v = f"val_{g['fecha'].replace('-', '')}_{k}.webp"
                Image.fromarray(rgba, "RGBA").save(sal / "views" / nombre_v, "WEBP", lossless=False, quality=85)
                vistas.append({"archivo": f"views/{nombre_v}", "fecha": g["fecha"], "capa": k, "rango_db": [lo, hi],
                               "coleccion": "validated", "crid": g["crid"], "esquinas_lonlat": esq_v})
            tramo_val.append({"fecha": g["fecha"], "escena": g["escena"], "crid": g["crid"],
                              "pct_valido": round(100 * float(ok_v.mean()), 1)})
        except (KeyError, OSError) as e_:
            print(f"  ! VALIDATED {g['fecha']}: {e_}")

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
    radar = prim["sensible"] >= 0
    met = []
    for u in (0.27, 0.44):
        op = dnbr > u; m = np.isfinite(dnbr) & valido
        vp, fp_, fn = int((radar & op & m).sum()), int((radar & ~op & m).sum()), int((~radar & op & m).sum())
        met.append({"referencia": f"dNBR > {u}", "precision": round(vp / max(vp + fp_, 1), 3), "exhaustividad": round(vp / max(vp + fn, 1), 3),
                    "dice": round(2 * vp / max(2 * vp + fp_ + fn, 1), 3)})
    en_p = dentro[(dentro["acq_date"] > pd.Timestamp(base[-1])) & (dentro["acq_date"] <= pd.Timestamp(objetivo[-1]))]
    # Acuerdo por clase óptica (dónde coincide y dónde se rompe): qué fracción de cada clase de dNBR marcó el radar.
    # Cortes 0,1 / 0,27 / 0,44: clases de severidad de uso general del USGS, no calibradas para la Chiquitanía.
    m_ok = np.isfinite(dnbr) & valido
    grupos_opt = [("severa", dnbr > 0.44), ("moderada", (dnbr > 0.27) & (dnbr <= 0.44)), ("leve", (dnbr > 0.1) & (dnbr <= 0.27)),
                  ("sin_cambio", (dnbr >= -0.1) & (dnbr <= 0.1)), ("reverdecio", dnbr < -0.1)]
    acuerdo = []
    for clave, sel in grupos_opt:
        n_tot, n_rad = int((sel & m_ok).sum()), int((sel & m_ok & radar).sum())
        acuerdo.append({"clase_optica": clave, "celdas": n_tot, "celdas_marcadas": n_rad,
                        "pct_marcado": None if n_tot == 0 else round(100 * n_rad / n_tot, 2),
                        "ha": round(n_tot * ha_px, 1), "ha_marcadas": round(n_rad * ha_px, 1)})
    escribir_json(sal / "validation.json", {
        "acuerdo_por_clase_optica": acuerdo,
        # Limitada si el par óptico no encierra el periodo del radar o si no hay zonas de control (§23.1, RF-11).
        "validacion_limitada": not (par_opt[0] == "antes_radar" and calib),
        "motivo_es": f"Par óptico {s2[par_opt[0]]['fecha']} → {s2[par_opt[1]]['fecha']} frente al radar {base[-1]} → {objetivo[-1]}. "
                     + ("Encierra el periodo del radar. " if par_opt[0] == "antes_radar" else "No coincide con el periodo del radar. ")
                     + "El dNBR incluye la caída de hojas estacional; la revisión visual (VC-05) sigue pendiente.",
        "motivo_en": f"Optical pair {s2[par_opt[0]]['fecha']} → {s2[par_opt[1]]['fecha']} against radar {base[-1]} → {objetivo[-1]}. "
                     + ("It brackets the radar period. " if par_opt[0] == "antes_radar" else "It does not match the radar period. ")
                     + "dNBR includes seasonal leaf fall; the visual review (VC-05) is still pending.",
        "vc01_sentinel2": {"fechas": [s2[par_opt[0]]["fecha"], s2[par_opt[1]]["fecha"]], "encierra_radar": par_opt[0] == "antes_radar", "metricas": met,
                           "referencia_literatura": "Belenguer-Plomer et al. (2019): Dice 0,59 en banda C"},
        "vc02_focos": {"parches_con_foco": sum(1 for f_ in feats if f_["properties"]["focos_durante"] + f_["properties"]["focos_despues"] > 0),
                       "parches_total": len(feats), "focos_periodo": int(len(en_p)), "focos_en_o_junto_a_parche": int((en_p["parche"] > 0).sum())},
        # VC-03: en las zonas de control el cambio debe ser menor que en los parches.
        "vc03_zonas_control": None if not calib else {
            "fecha": objetivo[-1], "cambio_control_db": round(float(np.nanmedian(rel[objetivo[-1]][ctrl])), 3),
            "cambio_parches_db": round(float(np.nanmedian(rel[objetivo[-1]][prim["sensible"] >= 0])), 3) if (prim["sensible"] >= 0).any() else None,
            "cumple": bool((prim["sensible"] >= 0).any() and np.nanmedian(rel[objetivo[-1]][ctrl]) > np.nanmedian(rel[objetivo[-1]][prim["sensible"] >= 0]))},
        "vc03_motivo": None if calib else "Sin zonas de control suficientes en esta caja",
        "vc05_revision_visual": None, "vc05_motivo": "Pendiente de registrar en el notebook"})

    # -------------------------------------------------------------- vistas y serie para explicar la respuesta paso a paso
    def rampa(a, lo, hi, colores, ok):
        """Colorea `a` entre lo y hi con una rampa lineal de colores hex; transparente fuera de `ok` (RN-13)."""
        x = np.nan_to_num(np.clip((a - lo) / (hi - lo), 0, 1))
        pos = np.linspace(0, 1, len(colores))
        cols = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in colores], float)
        rgb = np.stack([np.interp(x, pos, cols[:, k]) for k in range(3)], -1).astype(np.uint8)
        return np.dstack([rgb, np.where(ok & np.isfinite(a), 255, 0).astype(np.uint8)])

    def guardar(nombre, rgba):
        Image.fromarray(rgba, "RGBA").save(sal / "views" / nombre, "WEBP", lossless=False, quality=85)

    PALETAS = {"radar": ["#000000", "#ffffff"],                                       # oscuro → claro
               "cambio": ["#8c2d04", "#d9793a", "#f7f7f7", "#6aa3cf", "#1d4f85"],     # bajó → sin cambio → subió
               "optico": ["#1d6b3a", "#9fd3a8", "#f7f7f7", "#e2a86b", "#7a3a10"]}     # reverdeció → sin cambio → perdió
    guardar("linea_base_hv.webp", rampa(lb_db, -21, -9, PALETAS["radar"], valido))
    vistas.append({"archivo": "views/linea_base_hv.webp", "fecha": None, "capa": "base", "rango_db": [-21, -9]})
    for f in objetivo:
        nombre_v = f"{f.replace('-', '')}_cambio.webp"
        guardar(nombre_v, rampa(rel[f], -4, 4, PALETAS["cambio"], valido))
        vistas.append({"archivo": f"views/{nombre_v}", "fecha": f, "capa": "cambio", "rango_db": [-4, 4]})
    guardar("dnbr.webp", rampa(dnbr, -0.5, 0.5, PALETAS["optico"], np.isfinite(dnbr)))
    vistas.append({"archivo": "views/dnbr.webp", "fecha": s2["despues"]["fecha"], "capa": "dnbr", "rango": [-0.5, 0.5]})
    escribir_json(sal / "views" / "index.json", {
        "esquinas_lonlat": esquinas, "orden_esquinas": ["noroeste", "noreste", "sureste", "suroeste"],
        "nota": "Imágenes en la grilla UTM del radar; usar las 4 esquinas (p. ej. fuente 'image' de MapLibre). Píxel transparente = sin dato válido (RN-13).",
        "paletas": PALETAS, "vistas": vistas})

    # Serie para el gráfico: rango normal del paisaje (p10–p90 del cambio de HV) y mediana de cada clase de parche.
    clase_de = {f_["properties"]["id"]: f_["properties"]["clase"] for f_ in feats}
    px_clase = {k: np.isin(etq, [pid for pid, c in clase_de.items() if c == k]) for k, *_ in CLASES}
    puntos_serie = []
    for f in fechas:
        e = estado_f[f]
        fila = {"fecha": f, "estado": e["estado"], "rol": "linea_base" if f in base else "objetivo" if f in objetivo else None}
        if f in rel:
            r = rel[f][valido]
            p10, p50, p90 = (round(float(v), 3) for v in np.nanpercentile(r, [10, 50, 90]))
            fila.update(rango_normal=[p10, p90], mediana_paisaje=p50,
                        clases={k: (round(float(np.nanmedian(rel[f][m_])), 3) if m_.any() else None) for k, m_ in px_clase.items()})
        else:
            fila.update(rango_normal=None, mediana_paisaje=None, clases=None)
        puntos_serie.append(fila)
    escribir_json(sal / "serie.json", {
        "unidad": "dB, cambio de HV respecto de la línea base corregido por deriva de escena",
        "umbrales_db": [UMB["estricto"], UMB["sensible"]], "calibrados": bool(calib), "linea_base": base, "fechas": puntos_serie})

    # -------------------------------------------------------------- quality.json (CQ-01 a CQ-06)
    crss, tams = set(), set()
    for f in fechas:
        with rasterio.open(ruta(f, "HVHV")) as ds: crss.add(str(ds.crs)); tams.add((ds.width, ds.height, ds.transform.c, ds.transform.f))
    excl = [{"fecha": f, **estado_f[f]} for f in fechas if estado_f[f]["estado"] != "ok"]
    cache_cmr = META / "cmr_checksums.json"
    sumas = json.loads(cache_cmr.read_text()) if cache_cmr.exists() else {}
    for esc in serie["escena"]:
        if esc in sumas:
            continue
        try:   # CQ-06: la suma oficial publicada por NASA en CMR (no requiere login)
            import requests
            r_ = requests.get("https://cmr.earthdata.nasa.gov/search/granules.umm_json",
                              params={"short_name": cfg["nisar"]["colecciones"]["provisional"], "readable_granule_name": esc}, timeout=60)
            for a_ in r_.json()["items"][0]["umm"]["DataGranule"]["ArchiveAndDistributionInformation"]:
                if a_.get("Name") == f"{esc}.h5" and a_.get("Checksum"):
                    sumas[esc] = {"algoritmo": a_["Checksum"]["Algorithm"], "valor": a_["Checksum"]["Value"], "bytes": a_.get("SizeInBytes")}
        except Exception as e_:  # noqa: BLE001 - sin red, la procedencia queda incompleta y se dice
            print(f"  ! CMR {esc[:40]}…: {e_}")
    escribir_json(cache_cmr, sumas)
    granulos, sin_sum = [], []
    for _, r in serie.iterrows():
        archivos = {c: {"ruta": p, "sha256": sha256(RAIZ / p)} for c, p in r["rutas"].items()}
        granulos.append({"escena": r["escena"], "fecha": r["fecha"], "track": int(r["track"]), "direccion": r["direccion"], "frame": int(r["frame"]),
                         "polarizacion": r["polarizacion"], "coleccion": r["coleccion"], "crid": r["crid"], "epsg": int(r["epsg"]),
                         "suma_granulo": sumas.get(r["escena"]), "fuente_suma": "NASA CMR (UMM-G)", "recortes": archivos, "estado_en_serie": estado_f[r["fecha"]]["estado"]})
    escribir_json(sal / "quality.json", {
        "CQ-01_geometria": {"ok": bool(len(crss) == 1 and len(tams) == 1), "crs": sorted(crss), "grillas_distintas": len(tams)},
        "CQ-02_orbita": {"ok": bool(serie["track"].nunique() == 1 and serie["direccion"].nunique() == 1), "track": track, "direccion": dire, "frame": frame,
                          "separacion_dias": [int((pd.Timestamp(b) - pd.Timestamp(a)).days) for a, b in zip(fechas, fechas[1:])]},
        "CQ-03_radiometria": {"ok": True, "producto": "GCOV gamma-cero, potencia lineal", "fechas_excluidas": excl},
        "CQ-04_polarizaciones": {"ok": bool(serie["polarizacion"].eq("DHDH").all()), "nota": "Todas las fechas de la serie son DHDH (HH y HV)"},
        "CQ-05_datos_validos": {"pct_valido": round(100 * float(valido.mean()), 1), "limitada": bool(valido.mean() < 0.8)},
        "CQ-06_procedencia": {"ok": (cq06 := all(sumas.get(e_) for e_ in serie["escena"])),
                              "motivo": None if cq06 else "Falta la suma de verificación de algún gránulo original (CMR sin respuesta)",
                              "detalle": "MD5 y tamaño del gránulo original según NASA CMR; sha256 de cada recorte",
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
    # Publicada con límites cuando hay zonas de control y umbrales calibrados (MC-05, MC-03), procedencia completa
    # (CQ-06) y un par óptico que encierra al radar (VC-01). Los límites que quedan se listan (RN-04, RN-05).
    listo = bool(calib) and cq06 and par_opt[0] == "antes_radar"
    limites = (["linea_base_2_fechas"] if len(base) < 3 else []) + \
              ["quemado_antes_de_la_serie", "producto_provisional", "optico_con_fenologia", "revision_visual_pendiente"]
    if not calib: limites.insert(2, "umbrales_sin_calibrar")
    if par_opt[0] != "antes_radar": limites.insert(2, "optico_fuera_de_periodo")
    if not cq06: limites.append("procedencia_incompleta")
    escribir_json(sal / "station.json", {
        "id": est_id, "estado": "publicada_con_limites" if listo else "borrador_exploratorio",
        "aviso": ({"es": "Resultado con límites: datos NISAR PROVISIONAL, umbrales calibrados con zonas de control; ver los límites.",
                   "en": "Result with limits: NISAR PROVISIONAL data, thresholds calibrated with control zones; see the limits."} if listo else
                  {"es": "Borrador exploratorio: faltan zonas de control, umbrales calibrados o validación que encierre al radar. No son resultados (RN-04).",
                   "en": "Exploratory draft: control zones, calibrated thresholds or bracketing validation are missing. These are not results (RN-04)."}),
        "limites": limites,
        "decisiones": DECISIONES,
        "linea_base": {"fechas": base, "desviacion_mc02": len(base) < 3},
        "nombre": est.get("nombre", {"es": nombre, "en": nombre}),
        "departamento": est.get("departamento", "Santa Cruz"),
        "area": {"bbox_lonlat": [W, S, E, N], "criterio": est.get("criterio", {"es": cfg["descripcion"], "en": cfg["descripcion"]})},
        "orbita": {"track": track, "direccion": dire, "frame": frame, "coleccion": "PROVISIONAL", "crid": sorted(serie["crid"].unique())},
        "fechas": [{"fecha": f, **estado_f[f], "rol": "linea_base" if f in base else "objetivo" if f in objetivo else None} for f in fechas],
        "hueco_datos": [cfg["periodo"]["hueco"]["inicio"], cfg["periodo"]["hueco"]["fin"]],
        # RN-02: el tramo VALIDATED se muestra aparte; no entra a la serie ni a las cifras.
        "tramo_validated": tramo_val,
        "resumen_clases_ha": [{"clase": k, "es": es, "en": en, "ha": round(tot[k], 1)} for k, es, en in CLASES],
        "hipotesis": [{"es": "Las áreas quemadas muestran una caída sostenida de HV mayor que la variación estacional del bosque seco sin quemar.",
                       "en": "Burned areas show a sustained HV drop larger than the seasonal variation of unburned dry forest.",
                       "fuente": "Belenguer-Plomer et al. (2019)",
                       "nota": {"es": "banda C; la extensión a banda L es propuesta del equipo, §11.1",
                                "en": "C band; extending it to L band is a team proposal, §11.1"}},
                      {"es": "En un desmonte, HV cae primero y los focos llegan semanas después; en un incendio llegan juntos.",
                       "en": "In clearing, HV drops first and hotspots arrive weeks later; in a fire they arrive together.",
                       "fuente": "UraqiVision, documento maestro §11.2",
                       "nota": {"es": "hipótesis del equipo", "en": "team hypothesis"}}],
        "relato_local": None, "relato_local_motivo": "Lo redacta el equipo (RF-13); no se inventa",
        "preguntas_sugeridas": None, "preguntas_sugeridas_motivo": "Las redacta M-ATLAS (RF-17)",
        "archivos": ["manifest.json", "change.tif", "views/index.json", "serie.json", "control_candidatas.geojson", "control_propuesta.json", "scars.geojson", "hectares.csv", "validation.json",
                     "quality.json", "footprints.geojson", "fires.geojson", "atlas/departments.geojson"]})
    pesos = sum(p.stat().st_size for p in (sal / "views").glob("*.webp")) / 1e6
    print(f"Publicado en {sal.relative_to(RAIZ)}: {len(feats)} parches, vistas {pesos:.1f} MB (límite 40 MB, RNF-02)")


if __name__ == "__main__":
    main()
