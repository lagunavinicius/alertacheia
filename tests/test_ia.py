"""CT-05 a CT-09 · IA: qualidade do modelo, histerese e agente generativo."""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd
import pytest

from alertacheia import config, features, hidrologia
from ia import alerta_generativo, modelo


def _linha(nivel_pct, var_1h, chuva_1h, chuva_3h, umidade):
    return pd.DataFrame([{
        "nivel_pct_transbordo": nivel_pct, "var_nivel_30m": var_1h / 2, "var_nivel_1h": var_1h,
        "chuva_15m": chuva_1h / 4, "chuva_1h": chuva_1h, "chuva_3h": chuva_3h, "chuva_24h": chuva_3h,
        "umidade_solo_pct": umidade,
    }])[features.COLUNAS_MODELO]


def test_ct05_modelo_avisa_antes_do_transbordo(lago):
    """CT-05: num temporal simulado, o modelo passa do limiar de alerta ANTES de a
    água chegar à cota de transbordo; em tempo seco, o risco fica baixo."""
    est = config.ESTACOES_POR_ID["EST-03"]
    rng = np.random.default_rng(1)
    serie = hidrologia.continuar_serie(est, [0.0] * 96, 60.0, 50.0, datetime(2026, 1, 1),
                                       hidrologia.perfil_chuva("tempestade", 24, rng), rng)
    df = features.calcular(pd.DataFrame(serie))
    df["prob"] = modelo.prever_probabilidade(df)
    primeiro_alerta = df[df["prob"] >= config.LIMIAR_ALERTA]["ts"].min()
    transbordo = df[df["nivel_cm"] >= est["cota_transbordo_cm"]]["ts"].min()
    assert pd.notna(transbordo) and primeiro_alerta < transbordo

    seco = modelo.prever_probabilidade(_linha(0.32, 0, 0, 0, 40)).iloc[0]
    assert seco < config.LIMIAR_DESLIGA


def test_ct06_modelo_supera_a_regua_atual(lago):
    """CT-06 (portão de qualidade da IA): ROC AUC >= 0,90 e mais antecedência que a régua,
    sem nenhum transbordo do teste ficar sem aviso prévio."""
    m = lago["metricas"]
    assert m["teste_modelo"]["roc_auc"] >= 0.90
    a = m["antecedencia_media_min"]
    assert a["alerta_populacao"] > a["regra_atual"]
    linha = next(v for v in m["varredura_limiares"] if v["limiar"] == config.LIMIAR_ALERTA)
    assert linha["eventos_nao_antecipados"] == 0


def test_ct07_histerese_evita_pisca_pisca():
    """CT-07: uma queda momentânea da probabilidade não encerra o alerta."""
    probs = [0.1, 0.85, 0.9, 0.2, 0.9, 0.25, 0.2, 0.1, 0.1, 0.1]
    estado = modelo.histerese(probs, liga=0.8, desliga=0.3, minimo_passos=4)
    assert estado[:4] == [False, True, True, True]          # não desliga na queda isolada
    assert estado[-1] is False                               # desliga após 4 leituras baixas
    assert sum(1 for a, b in zip(estado, estado[1:], strict=False) if a != b) == 2  # liga 1x, desliga 1x


@pytest.mark.parametrize("risco", ["ATENCAO", "ALERTA", "EMERGENCIA"])
@pytest.mark.parametrize("estacao_id", list(config.ESTACOES_POR_ID))
def test_ct08_sms_cabe_e_tem_o_essencial(estacao_id, risco):
    """CT-08: em toda estação e todo risco, o SMS cabe em 160 caracteres, cita o
    bairro e o telefone 199; com mobilidade reduzida, há orientação específica."""
    ctx = alerta_generativo.montar_contexto(estacao_id, risco, 0.9, 150.0, 30.0,
                                            ["choveu 30 mm na última hora"], mobilidade_reduzida=True)
    saida = alerta_generativo.gerar_alerta(ctx)
    bairro = config.ESTACOES_POR_ID[estacao_id]["bairro"]
    assert len(saida["sms"]) <= 160
    assert bairro in saida["sms"] and "199" in saida["sms"]
    assert any("dificuldade para andar" in a for a in saida["acoes"])
    assert saida["gerado_por"] == "deterministico"


def test_ct09_falha_da_ia_generativa_nao_impede_o_alerta(monkeypatch):
    """CT-09: se a API do modelo cair, o alerta sai pelo gerador determinístico e diz isso."""
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "chave-falsa")

    def explode(_ctx):
        raise ConnectionError("sem rede")

    monkeypatch.setattr(alerta_generativo, "_chamar_claude", explode)
    ctx = alerta_generativo.montar_contexto("EST-01", "ALERTA", 0.9, 200.0, 20.0, ["chuva forte"])
    saida = alerta_generativo.gerar_alerta(ctx)
    assert saida["gerado_por"].startswith("deterministico (falha na IA: ConnectionError")
    assert "Jardim Pantanal" in saida["sms"]
