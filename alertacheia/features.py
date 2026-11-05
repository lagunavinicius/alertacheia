"""Engenharia de atributos compartilhada.

A mesma função gera os atributos no treino (a partir da camada gold) e na
inferência em tempo real (a partir das últimas leituras recebidas pela API).
Se o treino e a produção calculassem atributos de formas diferentes, o
modelo veria em produção um mundo diferente do que aprendeu.
"""

from __future__ import annotations

import pandas as pd

from alertacheia import config

L = config.LEITURAS_POR_HORA  # leituras por hora (4)

# Ordem fixa: o modelo é treinado e consultado com as colunas nesta ordem.
COLUNAS_MODELO = [
    "nivel_pct_transbordo",
    "var_nivel_30m",
    "var_nivel_1h",
    "chuva_15m",
    "chuva_1h",
    "chuva_3h",
    "chuva_24h",
    "umidade_solo_pct",
]


def calcular(df: pd.DataFrame) -> pd.DataFrame:
    """Recebe leituras (estacao_id, ts, nivel_cm, chuva_mm, umidade_solo_pct)
    ordenáveis no tempo e devolve o mesmo DataFrame com os atributos."""
    df = df.sort_values(["estacao_id", "ts"]).copy()
    cotas = {e["estacao_id"]: e["cota_transbordo_cm"] for e in config.ESTACOES}
    df["cota_transbordo_cm"] = df["estacao_id"].map(cotas)
    df["nivel_pct_transbordo"] = df["nivel_cm"] / df["cota_transbordo_cm"]

    g = df.groupby("estacao_id", group_keys=False)
    df["var_nivel_30m"] = g["nivel_cm"].diff(2).fillna(0.0)
    df["var_nivel_1h"] = g["nivel_cm"].diff(L).fillna(0.0)
    df["chuva_15m"] = df["chuva_mm"]
    for nome, janela in (("chuva_1h", L), ("chuva_3h", 3 * L), ("chuva_24h", 24 * L)):
        df[nome] = g["chuva_mm"].transform(lambda s, j=janela: s.rolling(j, min_periods=1).sum())
    return df


def rotular_transbordo_futuro(df: pd.DataFrame) -> pd.Series:
    """Alvo do modelo: o nível passa da cota de transbordo em algum momento
    das próximas 2 horas (sem contar o instante atual)?"""
    passos = config.HORIZONTE_PREVISAO_MIN // config.INTERVALO_MIN

    def _futuro(grupo: pd.DataFrame) -> pd.Series:
        acima = (grupo["nivel_cm"] >= grupo["cota_transbordo_cm"]).astype(int)
        # máximo das próximas `passos` leituras: inverte, janela móvel, desinverte
        futuro = acima[::-1].rolling(passos, min_periods=1).max()[::-1].shift(-1)
        return futuro.fillna(0).astype(int)

    return df.groupby("estacao_id", group_keys=False)[["nivel_cm", "cota_transbordo_cm"]].apply(_futuro)
