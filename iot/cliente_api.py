"""Cliente HTTP mínimo usado pelos dispositivos (TinkerCad e simulador).

Só usa a biblioteca padrão, como faria o firmware de um ESP32: monta o JSON,
manda a chave da estação no cabeçalho X-API-Key e trata a resposta.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime
from urllib.parse import urlparse

from api.seguranca import chave_da_estacao

API_PADRAO = os.environ.get("ALERTACHEIA_API", "http://127.0.0.1:8080")


def _url(api: str, caminho: str) -> str:
    """Só aceita http(s): impede que um argumento como file:// leia arquivos locais."""
    if urlparse(api).scheme not in ("http", "https"):
        raise ValueError(f"endereço da API inválido: {api}")
    return f"{api.rstrip('/')}{caminho}"


def enviar_leitura(api: str, leitura: dict) -> dict:
    corpo = {**leitura}
    if isinstance(corpo["ts"], datetime):
        corpo["ts"] = corpo["ts"].isoformat(timespec="minutes")
    # o esquema da URL é validado em _url (só http/https)
    requisicao = urllib.request.Request(  # noqa: S310
        _url(api, "/api/leituras"),
        data=json.dumps(corpo).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": chave_da_estacao(corpo["estacao_id"])},
        method="POST",
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=10) as resposta:  # noqa: S310  # nosec B310
            return json.loads(resposta.read())
    except urllib.error.HTTPError as erro:
        return {"erro": erro.code, "detalhe": json.loads(erro.read() or b"{}").get("detail")}


def obter(api: str, caminho: str) -> dict | list:
    with urllib.request.urlopen(_url(api, caminho), timeout=10) as resposta:  # noqa: S310  # nosec B310
        return json.loads(resposta.read())
