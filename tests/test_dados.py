"""CT-01 a CT-04 · Big Data: qualidade e processamento do Data Lake."""

from __future__ import annotations

import json

import pandas as pd

from alertacheia import config, features
from dados import pipeline


def test_ct01_quarentena_retem_leituras_invalidas(lago):
    """CT-01: valores vazios ou fisicamente impossíveis vão para a quarentena com motivo."""
    q = pd.read_parquet(config.QUARENTENA / "leituras_rejeitadas.parquet")
    assert len(q) > 0
    assert {"nivel_cm_vazio", "nivel_cm_fora_da_faixa"} <= set(q["motivo"])
    silver = pd.read_parquet(config.SILVER / "leituras.parquet")
    validos = silver.dropna(subset=["nivel_cm"])
    assert validos["nivel_cm"].between(*config.FAIXA_NIVEL_CM).all()
    assert validos["umidade_solo_pct"].between(*config.FAIXA_UMIDADE_PCT).all()


def test_ct02_silver_sem_duplicatas(lago):
    """CT-02: reenvios do sensor são removidos; cada estação tem uma leitura por instante."""
    assert lago["resumo"]["duplicadas_removidas"] > 0
    silver = pd.read_parquet(config.SILVER / "leituras.parquet")
    assert not silver.duplicated(subset=["estacao_id", "ts"]).any()


def test_ct03_lacunas_curtas_interpoladas_longas_nao(lago):
    """CT-03: até 30 min sem sinal é interpolado e marcado; lacunas longas ficam vazias."""
    bruto = pd.DataFrame({
        "estacao_id": "EST-01",
        "ts": pd.to_datetime(["2026-01-01 00:00", "2026-01-01 00:15", "2026-01-01 00:45",   # falta 00:30
                              "2026-01-01 03:00"]),                                       # falta 2h
        "nivel_cm": [100.0, 110.0, 130.0, 90.0], "chuva_mm": [0.0, 1.0, 2.0, 0.0],
        "umidade_solo_pct": [40.0, 41.0, 43.0, 40.0], "origem": "historico",
    })
    silver, _ = pipeline.para_silver(bruto)
    linha_0030 = silver[silver["ts"] == "2026-01-01 00:30"].iloc[0]
    assert linha_0030["imputado"] and linha_0030["nivel_cm"] == 120.0
    assert silver[silver["ts"] == "2026-01-01 02:00"].iloc[0]["sem_sinal"]


def test_ct04_atributos_identicos_no_treino_e_ao_vivo(lago):
    """CT-04: a mesma função calcula os atributos no lago e na API (sem desvio treino/produção)."""
    fato = pd.read_parquet(config.GOLD / "fato_leituras.parquet")
    est = fato[fato["estacao_id"] == "EST-02"].sort_values("ts").reset_index(drop=True)
    fim = est["ts"].iloc[2000]
    janela = est[est["ts"] <= fim].tail(97)[["estacao_id", "ts", "nivel_cm", "chuva_mm", "umidade_solo_pct"]]
    ao_vivo = features.calcular(janela).iloc[-1]
    no_lago = est[est["ts"] == fim].iloc[0]
    for coluna in features.COLUNAS_MODELO:
        assert abs(float(ao_vivo[coluna]) - float(no_lago[coluna])) < 1e-6, coluna
    resumo = json.loads((config.GOLD / "_resumo_pipeline.json").read_text(encoding="utf-8"))
    assert resumo["eventos_transbordo"] > 0
