"""Regenera docs/UraqiVisionDocumentoMaestrov1.1.txt a partir del PDF del documento maestro.

Uso (desde la raiz del repositorio):
    uv run --with pypdf python ai/scripts/extraer_documento.py

El texto sirve para que los asistentes de IA busquen identificadores (RF-xx, RN-xx, MC-xx...)
sin poder leer el PDF. El PDF sigue siendo la fuente de verdad.
"""
import pathlib
import sys

import pypdf

RAIZ = pathlib.Path(__file__).resolve().parents[2]
PDF = RAIZ / "docs" / "UraqiVisionDocumentoMaestrov1.1.pdf"
TXT = PDF.with_suffix(".txt")
CABECERA = (
    "<!-- Texto extraido automaticamente de docs/UraqiVisionDocumentoMaestrov1.1.pdf con "
    "ai/scripts/extraer_documento.py. Las tablas pierden su formato (una celda por linea). "
    "Ante cualquier diferencia, prevalece el PDF. No editar a mano: regenerar. -->\n\n"
)


def main() -> int:
    if not PDF.exists():
        print(f"No existe {PDF}", file=sys.stderr)
        return 1
    lector = pypdf.PdfReader(str(PDF))
    paginas = [p.extract_text() or "" for p in lector.pages]
    TXT.write_text(CABECERA + "\n\n=== PAGE ===\n".join(paginas), encoding="utf-8")
    print(f"{len(paginas)} paginas -> {TXT.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
