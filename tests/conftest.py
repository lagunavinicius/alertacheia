"""Ambiente isolado para os testes.

Os testes nunca tocam o Data Lake, o modelo nem o banco do projeto: tudo é
reconstruído numa pasta temporária, a partir do zero, com o mesmo código da
entrega. As variáveis de ambiente precisam existir ANTES de importar
`alertacheia.config`, por isso ficam no topo deste arquivo.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

_TMP = Path(tempfile.mkdtemp(prefix="alertacheia_testes_"))
os.environ["ALERTACHEIA_DATALAKE"] = str(_TMP / "datalake")
os.environ["ALERTACHEIA_MODELOS"] = str(_TMP / "modelos")
os.environ["ALERTACHEIA_BANCO"] = str(_TMP / "data" / "alertacheia.db")
os.environ["ALERTACHEIA_JWT_SEGREDO"] = "segredo-de-teste-com-mais-de-32-caracteres!!"
os.environ["ALERTACHEIA_OPERADOR"] = "operador_teste"
os.environ["ALERTACHEIA_OPERADOR_SENHA"] = "senha-de-teste-123"
os.environ["ALERTACHEIA_CHAVE_SENSORES"] = "segredo-sensores-teste"
os.environ["ANTHROPIC_API_KEY"] = ""  # testes nunca chamam a API externa

import pytest  # noqa: E402

from alertacheia import config  # noqa: E402


@pytest.fixture(scope="session")
def lago():
    """Gera histórico, Data Lake e modelo uma vez para a sessão inteira."""
    from dados import gerador, pipeline
    from ia import treinar

    gerador.gerar()
    resumo = pipeline.executar()
    metricas = treinar.treinar()
    return {"resumo": resumo, "metricas": metricas}


@pytest.fixture()
def cliente(lago):
    """API com banco zerado a cada teste."""
    from fastapi.testclient import TestClient

    from api import seguranca

    if config.BANCO.exists():
        config.BANCO.unlink()
    for sufixo in ("-wal", "-shm"):
        extra = Path(str(config.BANCO) + sufixo)
        if extra.exists():
            extra.unlink()
    seguranca.limitador_login._falhas.clear()
    from api.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def token(cliente):
    r = cliente.post("/api/auth/login", json={"usuario": "operador_teste", "senha": "senha-de-teste-123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
