"""Carrega o modelo de risco treinado e faz a previsão.

A API, o pipeline e os testes usam esta função. O modelo é carregado uma vez
e reaproveitado.
"""

from __future__ import annotations

from functools import lru_cache

import joblib
import pandas as pd

from alertacheia import config, features

ARQUIVO_MODELO = config.MODELOS / "modelo_risco.joblib"


class ModeloAusente(RuntimeError):
    """O modelo ainda não foi treinado (rode `python run_pipeline.py`)."""


@lru_cache(maxsize=1)
def carregar():
    if not ARQUIVO_MODELO.exists():
        raise ModeloAusente(f"modelo não encontrado em {ARQUIVO_MODELO}; rode `python run_pipeline.py`")
    return joblib.load(ARQUIVO_MODELO)


def prever_probabilidade(df_features: pd.DataFrame) -> pd.Series:
    """Probabilidade de transbordo nas próximas 2 h para cada linha."""
    modelo = carregar()
    x = df_features[features.COLUNAS_MODELO].astype(float)
    return pd.Series(modelo.predict_proba(x)[:, 1], index=df_features.index)


def histerese(probs, liga: float = 0.60, desliga: float = 0.30, minimo_passos: int = 4) -> list[bool]:
    """Transforma a probabilidade em estado de alerta sem "pisca-pisca".

    O alerta liga quando a probabilidade passa de `liga` e só desliga depois
    de `minimo_passos` leituras seguidas abaixo de `desliga` (1 h). Um
    morador que recebe "alerta", depois "tudo normal" e de novo "alerta" em
    meia hora deixa de confiar no sistema.
    """
    estado, abaixo, saida = False, 0, []
    for p in probs:
        if not estado and p >= liga:
            estado, abaixo = True, 0
        elif estado:
            abaixo = abaixo + 1 if p < desliga else 0
            if abaixo >= minimo_passos:
                estado, abaixo = False, 0
        saida.append(estado)
    return saida


def explicar(linha: pd.Series) -> list[str]:
    """Motivos legíveis da previsão, para o alerta e para o painel."""
    motivos = []
    if linha["nivel_pct_transbordo"] >= 1.0:
        motivos.append("a água já passou do limite do córrego")
    elif linha["nivel_pct_transbordo"] >= 0.8:
        motivos.append(f"a água já chegou a {linha['nivel_pct_transbordo']:.0%} do limite do córrego")
    if linha["var_nivel_1h"] >= 15:
        motivos.append(f"o córrego subiu {linha['var_nivel_1h']:.0f} cm na última hora")
    if linha["chuva_1h"] >= 10:
        motivos.append(f"choveu {linha['chuva_1h']:.0f} mm na última hora")
    if linha["chuva_3h"] >= 25:
        motivos.append(f"acumulado de {linha['chuva_3h']:.0f} mm em 3 horas")
    if linha["umidade_solo_pct"] >= 75:
        motivos.append("o solo está encharcado e não absorve mais água")
    return motivos or ["condições estáveis"]
