SHELL := /bin/bash
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)
RUN := docker compose run --rm uraqi

# Parámetros de recortar: make recortar COLECCION=provisional TRACK=60 DIR=A [MAX=2]
COLECCION ?= provisional
TRACK ?=
DIR ?=
MAX ?=

.PHONY: build shell lab comprobar listar recortar firms sentinel2 limites huellas verificar

build:            ## construye la imagen
	docker compose build

shell:            ## bash dentro del contenedor
	$(RUN) bash

lab:              ## JupyterLab en http://127.0.0.1:8888 (el token sale en la consola)
	docker compose run --rm --service-ports uraqi

comprobar:        ## importa todas las librerías
	$(RUN) python scripts/00_comprobar_entorno.py

listar:           ## 01: tabla de escenas NISAR y recomendación de track
	$(RUN) python scripts/01_nisar_listar.py

recortar:         ## 02: recortes NISAR (COLECCION, TRACK, DIR, MAX)
	@test -n "$(TRACK)" -a -n "$(DIR)" || { echo "Uso: make recortar COLECCION=provisional TRACK=<n> DIR=<A|D> [MAX=<k>]"; exit 2; }
	$(RUN) python scripts/02_nisar_recortar.py --coleccion $(COLECCION) --track $(TRACK) --dir $(DIR) $(if $(MAX),--max-fechas $(MAX))

firms:            ## 03: focos FIRMS de Bolivia
	$(RUN) python scripts/03_firms.py

sentinel2:        ## 04: Sentinel-2 antes/después
	$(RUN) python scripts/04_sentinel2.py

limites:          ## 05: departamentos de Bolivia
	$(RUN) python scripts/05_limites.py

huellas:          ## 06: huellas NISAR sobre Bolivia
	$(RUN) python scripts/06_huellas_bolivia.py

verificar:        ## 07: valida GeoTIFF y hace quicklooks
	$(RUN) python scripts/07_verificar.py
