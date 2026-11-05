"""Monta o .zip da entrega: código + README + PDF de entregáveis + GRUPO.txt.

    python scripts/empacotar.py           ->  entrega/AlertaCheia_GS2026-2.zip

Fica de fora tudo o que se reconstrói com o README (ambiente virtual,
node_modules, Data Lake, modelo treinado, banco local) e os segredos (.env).
Antes de empacotar, o script confere os itens que o enunciado cobra.
"""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "entrega" / "AlertaCheia_GS2026-2.zip"
FORA = {".venv", "node_modules", "datalake", "data", "dist", "artefatos", "__pycache__", ".pytest_cache",
        ".ruff_cache", "entrega", ".git", ".claude"}
ARQUIVOS_FORA = {".env", ".coverage", "_entregaveis.html", "4ESOA - Global Solution 2026-2.pptx_RevFInal.pdf"}


def conferir() -> list[str]:
    problemas = []
    grupo = (RAIZ / "GRUPO.txt").read_text(encoding="utf-8")
    if "<" in grupo:
        problemas.append("GRUPO.txt ainda tem campos <...> a preencher (grupo, RMs, nomes ou link do pitch)")
    if not re.search(r"https?://", grupo):
        problemas.append("GRUPO.txt sem o link do vídeo pitch")
    readme = (RAIZ / "README.md").read_text(encoding="utf-8")
    if "<COLE AQUI" in readme:
        problemas.append("README.md sem o link do vídeo pitch")
    if not (RAIZ / "docs" / "AlertaCheia_entregaveis.pdf").exists():
        problemas.append("PDF ausente: rode python scripts/gerar_pdf.py")
    return problemas


def main() -> None:
    problemas = conferir()
    for p in problemas:
        print(f"[atenção] {p}")
    if problemas and "--forcar" not in sys.argv:
        sys.exit("Corrija os itens acima (cada um custa -1 ponto) ou rode com --forcar.")

    DESTINO.parent.mkdir(exist_ok=True)
    total = 0
    with zipfile.ZipFile(DESTINO, "w", zipfile.ZIP_DEFLATED) as z:
        for arquivo in sorted(RAIZ.rglob("*")):
            rel = arquivo.relative_to(RAIZ)
            if arquivo.is_dir() or FORA & set(rel.parts) or arquivo.name in ARQUIVOS_FORA:
                continue
            z.write(arquivo, Path("AlertaCheia") / rel)
            total += 1
    print(f"{DESTINO} · {total} arquivos · {DESTINO.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
