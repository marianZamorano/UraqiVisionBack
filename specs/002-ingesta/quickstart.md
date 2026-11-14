# Quickstart: comprobar la ingesta (002-ingesta)

**Fecha**: 2026-11-14 · Guía de validación para cuando exista la implementación. Los nombres de los comandos
son una **propuesta**; los fija la base del pipeline (`specs/001-base-pipeline`).

## Requisitos

- El entorno del pipeline, con GDAL 3.13 o superior.
- Una cuenta gratuita de Earthdata, con sus credenciales en `.netrc` local. Nunca en el repositorio.
- Una clave gratuita de FIRMS en el entorno local, solo para los focos.

## Pasos de validación

1. **Pruebas sin red**: ejecutar `pytest` sobre `tests/ingesta/`. Deben pasar con datos sintéticos (PS-01) y
   demostrar que el COG conserva los valores (PS-02).
2. **Listado**: listar las escenas del catálogo para el área y el periodo. Comprobar que la serie de la órbita
   060 ascendente tiene una sola madurez y un solo CRID, y que la fecha que solo tiene HH figura como excluida,
   con su motivo (SC-001, SC-005).
3. **Primer par**: recortar una fecha anterior y otra posterior al hueco. Comprobar que hay un archivo por
   frame, en potencia lineal y con la grilla del producto (SC-008).
4. **Integridad**: comparar una ventana del recorte con la misma ventana leída del producto original; los
   valores deben ser idénticos (SC-002).
5. **Procedencia**: abrir los datos de procedencia y comprobar que cada escena tiene su suma del gránulo, la
   suma de cada recorte y ningún campo vacío (SC-003).
6. **Repetición**: relanzar la ingesta. No debe volver a obtener lo que ya es válido, y las sumas de los
   archivos deben ser las mismas (SC-006).
7. **Huellas**: comparar cada huella con el polígono del catálogo de su escena (SC-004).
8. **Credenciales**: buscar secretos en el repositorio y en las salidas; el resultado debe ser cero (SC-007).

Detalle de las entidades en [data-model.md](data-model.md) y de las salidas en
[contracts/salidas-ingesta.md](contracts/salidas-ingesta.md).
