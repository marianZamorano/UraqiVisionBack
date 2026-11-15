#!/usr/bin/env python
"""02 - Recorta la caja de cada escena NISAR L2 GCOV DHDH de un track.

NUNCA descarga el HDF5 completo: abre el archivo remoto con earthaccess.open y lee
con h5py solo la ventana que cae sobre la caja (lecturas parciales por HTTP).
Escribe GeoTIFF COG en potencia LINEAL float32 (mask en su tipo original).

Uso:
  02_nisar_recortar.py --coleccion provisional|validated --track N --dir A|D [--max-fechas K]

Se puede cortar y volver a lanzar: salta lo que ya existe y es válido.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

import numpy as np

from _comun import (RAW, a_fecha, actualizar_manifest, buscar_nisar, caja, cargar_config,
                    comprobar_limite, con_reintentos, escribir_cog, gb_usados, leer_manifest,
                    parsear_nombre_nisar, rel, tamano_bytes, tif_valido)

_proyeccion_mostrada = False
MINUTOS_POR_INTENTO = 12     # una escena normal tarda ~3 min; pasado esto se da por colgada
INTENTOS = 5


def leer_epsg(grupo) -> int:
    """Lee el EPSG del dataset `projection`. Tolera las variantes conocidas e informa cuál usó."""
    global _proyeccion_mostrada
    ds = grupo["projection"]
    attrs = {k: ds.attrs[k] for k in ds.attrs}
    origen, epsg = None, None
    if "epsg_code" in attrs:
        epsg, origen = int(np.asarray(attrs["epsg_code"]).ravel()[0]), "atributo epsg_code"
    elif ds.shape == () and np.issubdtype(ds.dtype, np.integer):
        epsg, origen = int(ds[()]), "valor escalar del dataset"
    elif "spatial_ref" in attrs:
        from pyproj import CRS
        wkt = attrs["spatial_ref"]
        wkt = wkt.decode() if isinstance(wkt, bytes) else str(wkt)
        epsg, origen = CRS.from_wkt(wkt).to_epsg(), "atributo spatial_ref (WKT)"
    if not _proyeccion_mostrada:
        _proyeccion_mostrada = True
        valor = ds[()] if ds.shape == () else f"shape {ds.shape}"
        print(f"  [projection] dtype={ds.dtype} valor={valor!r} atributos={sorted(attrs)} "
              f"-> EPSG {epsg} (de: {origen})")
    if not epsg:
        raise RuntimeError(f"No pude sacar el EPSG de `projection` (atributos: {sorted(attrs)}). "
                           "Hay que inspeccionar el archivo.")
    return epsg


def ventana(x: np.ndarray, y: np.ndarray, limites) -> tuple[slice, slice] | None:
    """Índices (filas, columnas) de los píxeles cuyo centro cae dentro de `limites` (en el CRS del grid)."""
    xmin, ymin, xmax, ymax = limites
    cols = np.where((x >= xmin) & (x <= xmax))[0]
    filas = np.where((y >= ymin) & (y <= ymax))[0]
    if cols.size == 0 or filas.size == 0:
        return None
    return slice(int(filas[0]), int(filas[-1]) + 1), slice(int(cols[0]), int(cols[-1]) + 1)


def procesar(g, d: dict, col: str, cfg: dict, destino, capas: list[str]) -> dict:
    """Abre el HDF5 remoto y escribe el recorte de cada capa. Devuelve la entrada del manifest."""
    import earthaccess
    import h5py
    from pyproj import Transformer
    from rasterio.transform import from_origin

    nombre = cfg["nombre"]
    fecha8 = d["fecha"].replace("-", "")
    base = f"{nombre}_{fecha8}_T{d['track']:03d}{d['direccion']}_F{d['frame']:03d}"
    rutas = {c: destino / f"{base}_{c}.tif" for c in capas}

    fobj = earthaccess.open([g])[0]      # archivo remoto: solo se leen los bytes pedidos
    try:
        with h5py.File(fobj, "r") as h5:
            grp = h5[cfg["nisar"]["grupo"]]
            faltan = [c for c in capas if c not in grp]
            if faltan:
                raise RuntimeError(f"Faltan capas {faltan} en {cfg['nisar']['grupo']}; hay: {sorted(grp)}")
            epsg = leer_epsg(grp)
            x = grp["xCoordinates"][:]
            y = grp["yCoordinates"][:]
            dx = float(np.median(np.diff(x)))
            dy = float(np.median(np.diff(y)))     # normalmente negativo (norte arriba)
            tr = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
            lim = tr.transform_bounds(*caja(cfg), densify_pts=21)
            win = ventana(x, y, lim)
            entrada = {"escena": d["escena"], "fecha": d["fecha"], "track": d["track"],
                       "direccion": d["direccion"], "frame": d["frame"],
                       "polarizacion": d["polarizacion"], "coleccion": col, "crid": d["crid"],
                       "epsg": epsg, "resolucion_m": [abs(dx), abs(dy)]}
            if win is None:
                entrada.update(estado="sin_solape", tamano_px=None, rutas={})
                return entrada
            fs, cs = win
            if dy > 0:   # grid con el sur arriba: no esperado, pero se respeta volteando
                voltear = True
                y0 = float(y[fs.stop - 1]) + dy / 2
            else:
                voltear = False
                y0 = float(y[fs.start]) - dy / 2
            transform = from_origin(float(x[cs.start]) - dx / 2, y0, abs(dx), abs(dy))

            for capa in capas:
                if tif_valido(rutas[capa]):
                    continue
                ds = grp[capa]
                arr = ds[fs, cs]
                if voltear:
                    arr = arr[::-1]
                relleno = ds.attrs.get("_FillValue")
                relleno = None if relleno is None else np.asarray(relleno).ravel()[0]
                if capa == "mask":
                    nodata = None if relleno is None else int(relleno)     # tipo original
                else:
                    arr = arr.astype(np.float32, copy=False)                # potencia lineal tal cual
                    if relleno is not None and not np.isnan(relleno):
                        arr = np.where(arr == np.float32(relleno), np.nan, arr).astype(np.float32)
                    nodata = float("nan")
                escribir_cog(rutas[capa], np.ascontiguousarray(arr), f"EPSG:{epsg}", transform, nodata,
                             tags={"escena": d["escena"], "capa": capa, "coleccion": col,
                                   "crid": d["crid"], "fecha": d["fecha"],
                                   "unidades": "tipo original" if capa in ("mask", "numberOfLooks")
                                   else "potencia lineal (sin dB)"})
            alto, ancho = fs.stop - fs.start, cs.stop - cs.start
    finally:
        try:
            fobj.close()
        except Exception:  # noqa: BLE001
            pass
    entrada.update(estado="ok", tamano_px=[ancho, alto], rutas={c: rel(p) for c, p in rutas.items()})
    return entrada


def elegir_fechas(fechas: list[str], k: int | None, hueco) -> list[str]:
    """Con --max-fechas K toma K fechas repartidas, siempre la primera y la última
    (con K=2: una antes y otra después del hueco, si hay datos a ambos lados)."""
    fechas = sorted(fechas)
    if not k or k >= len(fechas):
        return fechas
    if k == 1:
        return fechas[:1]
    idx = sorted(set(np.linspace(0, len(fechas) - 1, k).round().astype(int).tolist()))
    sel = [fechas[i] for i in idx]
    antes = [f for f in fechas if a_fecha(f) < hueco[0]]
    despues = [f for f in fechas if a_fecha(f) > hueco[1]]
    if antes and despues and not (set(sel) & set(antes) and set(sel) & set(despues)):
        sel = sorted(set(sel[:-1] + [antes[0], despues[-1]]))[:k]
    return sel


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coleccion", required=True, choices=["provisional", "validated"])
    ap.add_argument("--track", required=True, type=int)
    ap.add_argument("--dir", required=True, choices=["A", "D"], dest="direccion")
    ap.add_argument("--max-fechas", type=int, default=None)
    ap.add_argument("--escena", help=argparse.SUPPRESS)   # uso interno: procesa una sola escena
    args = ap.parse_args()

    cfg = cargar_config()
    col = args.coleccion
    destino = RAW / f"nisar_{col}"          # PROVISIONAL y VALIDATED nunca comparten carpeta
    capas = list(cfg["nisar"]["capas"])
    hueco = (a_fecha(cfg["periodo"]["hueco"]["inicio"]), a_fecha(cfg["periodo"]["hueco"]["fin"]))

    if not (os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD")):
        sys.exit("Faltan EARTHDATA_USERNAME / EARTHDATA_PASSWORD. Copia .env.example a .env y "
                 "complétalo (cuenta gratis en https://urs.earthdata.nasa.gov/users/new).")
    import earthaccess
    con_reintentos(earthaccess.login, strategy="environment", que="login Earthdata")

    grans = buscar_nisar(cfg["nisar"]["colecciones"][col], caja(cfg),
                         cfg["periodo"]["inicio"], cfg["periodo"]["fin"])
    cand = {}
    for g in grans:
        try:
            d = parsear_nombre_nisar(g["umm"]["GranuleUR"])
        except ValueError as e:
            print(f"  ! {e}")
            continue
        if (d["track"], d["direccion"], d["polarizacion"]) != (args.track, args.direccion,
                                                                 cfg["nisar"]["polarizacion"]):
            continue
        k = (d["fecha"], d["frame"])        # si hay reprocesos, queda el CRID/contador más alto
        if k not in cand or (d["crid"], d["contador"]) > (cand[k][1]["crid"], cand[k][1]["contador"]):
            cand[k] = (g, d)
    if not cand:
        sys.exit(f"No hay escenas {cfg['nisar']['polarizacion']} en {col} para el track "
                 f"{args.track} {args.direccion}. Corre 01 para ver qué hay.")

    if args.escena:
        # Modo hijo: una sola escena, un solo intento. El padre vigila el tiempo y reintenta,
        # porque una lectura HTTP colgada no se puede cancelar desde el mismo proceso.
        g, d = next(v for v in cand.values() if v[1]["escena"] == args.escena)
        actualizar_manifest("nisar", d["escena"], procesar(g, d, col, cfg, destino, capas))
        return

    fechas = elegir_fechas(sorted({k[0] for k in cand}), args.max_fechas, hueco)
    trabajos = [cand[k] for k in sorted(cand) if k[0] in fechas]
    print(f"{col}: track {args.track:03d}{args.direccion}, {len(fechas)} fechas, "
          f"{len(trabajos)} escenas (frames). Remoto: "
          f"{sum(tamano_bytes(g) for g, _ in trabajos) / 1e9:.1f} GB que NO se descargan enteros.")

    manifest = leer_manifest().get("nisar", {})
    hechos, fallos, pesos = 0, [], []
    for i, (g, d) in enumerate(trabajos, 1):
        etiqueta = f"[{i}/{len(trabajos)}] {d['fecha']} F{d['frame']:03d} {d['crid']}"
        previo = manifest.get(d["escena"])
        if previo and previo.get("estado") == "sin_solape":
            print(f"{etiqueta}: sin solape con la caja (ya registrado), salto")
            continue
        if previo and previo.get("estado") == "ok" and previo.get("rutas") and all(
                tif_valido(RAW.parent.parent / p) for p in previo["rutas"].values()):
            print(f"{etiqueta}: ya existe y es válido, salto")
            continue
        comprobar_limite(extra_gb=(np.mean(pesos) if pesos else 0.1) * (len(trabajos) - i + 1))
        antes = gb_usados(destino)
        print(f"{etiqueta}: leyendo recorte...", flush=True)
        orden = [sys.executable, os.path.abspath(__file__), "--coleccion", col, "--track",
                 str(args.track), "--dir", args.direccion, "--escena", d["escena"]]
        error = None
        for intento in range(1, INTENTOS + 1):
            try:
                r = subprocess.run(orden, timeout=MINUTOS_POR_INTENTO * 60, stderr=subprocess.PIPE,
                                   text=True)
                if r.returncode == 0:
                    error = None
                    break
                lineas = [x for x in r.stderr.strip().splitlines() if x.strip()]
                error = lineas[-1] if lineas else f"código {r.returncode}"
            except subprocess.TimeoutExpired:
                error = f"colgado más de {MINUTOS_POR_INTENTO} min (se mató el proceso)"
            except KeyboardInterrupt:
                sys.exit("\nInterrumpido. Vuelve a lanzar el mismo comando para retomar.")
            if intento < INTENTOS:
                espera = 10 * 2 ** (intento - 1)
                print(f"  ! {error} (intento {intento}/{INTENTOS}, espero {espera}s; "
                      "retoma en la capa donde quedó)", flush=True)
                time.sleep(espera)
        if error:
            print(f"  X FALLÓ {d['escena']}: {error}")
            fallos.append((d["escena"], error))
            continue
        entrada = leer_manifest()["nisar"][d["escena"]]
        if entrada["estado"] == "ok":
            pesos.append(gb_usados(destino) - antes)
            hechos += 1
            print(f"  ok {entrada['tamano_px'][0]}x{entrada['tamano_px'][1]} px, "
                  f"{entrada['resolucion_m'][0]:g} m, EPSG:{entrada['epsg']}, "
                  f"{pesos[-1] * 1e3:.0f} MB")
        else:
            print("  la huella toca la caja pero el grid no la cubre: sin solape")

    print(f"\nListo: {hechos} escenas nuevas, {len(fallos)} fallos. "
          f"{rel(destino)} pesa {gb_usados(destino):.2f} GB.")
    for esc, err in fallos:
        print(f"  FALLO {esc}: {err}")
    if fallos:
        sys.exit(1)


if __name__ == "__main__":
    main()
