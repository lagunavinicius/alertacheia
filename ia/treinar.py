"""Treino e avaliação do modelo de risco de transbordo.

Pergunta que o modelo responde: "este córrego vai transbordar nas próximas
2 horas?". Ele aprende com a camada gold (nível, tendência, chuva acumulada e
umidade do solo) e é comparado com a prática atual: a régua, em que o
alerta só sai quando o nível já passou da cota de alerta.

A divisão treino/teste é temporal (primeiros 70% dos dias para treino, o
resto para teste). Dividir ao acaso vazaria o futuro para o treino, porque
leituras vizinhas de 15 min são quase idênticas.

Rodar:  python -m ia.treinar
"""

from __future__ import annotations

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from alertacheia import config, features
from ia.modelo import ARQUIVO_MODELO, histerese

LIMIAR_ALERTA = config.LIMIAR_ALERTA   # mesma faixa "ALERTA" de config.NIVEIS_RISCO
JANELA_BUSCA_H = 6     # antecedência máxima considerada antes de um transbordo


def _metricas(y_true, y_pred, y_prob=None) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    m = {
        "acuracia": round(accuracy_score(y_true, y_pred), 4),
        "precisao": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, zero_division=0), 4),
        "matriz_confusao": {"vn": int(tn), "fp": int(fp), "fn": int(fn), "vp": int(tp)},
    }
    if y_prob is not None:
        m["roc_auc"] = round(roc_auc_score(y_true, y_prob), 4)
    return m


def _antecedencia(g: pd.DataFrame, coluna_alerta: str, inicio: pd.Timestamp) -> float:
    """Minutos entre o começo do alerta contínuo e o início do transbordo.

    Procura o trecho de alerta ininterrupto que está ativo no instante anterior
    ao transbordo. Sem alerta antes do transbordo, a antecedência é 0: a
    população só fica sabendo quando a água já chegou.
    """
    janela = g[(g["ts"] < inicio) & (g["ts"] >= inicio - pd.Timedelta(hours=JANELA_BUSCA_H))]
    if janela.empty or not bool(janela[coluna_alerta].iloc[-1]):
        return 0.0
    ativo = janela[coluna_alerta].to_numpy()[::-1]
    passos = int(np.argmin(ativo)) if not ativo.all() else len(ativo)
    return float(passos * config.INTERVALO_MIN)


def _falsos_alarmes(g: pd.DataFrame, coluna_alerta: str) -> int:
    """Trechos de alerta que não foram seguidos de transbordo em até 2 h."""
    alerta = g[coluna_alerta].astype(bool).to_numpy()
    transb = g["acima_transbordo"].astype(bool).to_numpy()
    passos = config.HORIZONTE_PREVISAO_MIN // config.INTERVALO_MIN
    falsos, i = 0, 0
    while i < len(alerta):
        if alerta[i]:
            j = i
            while j + 1 < len(alerta) and alerta[j + 1]:
                j += 1
            if not transb[i: j + passos + 1].any():
                falsos += 1
            i = j + 1
        else:
            i += 1
    return falsos


def treinar() -> dict:
    fato = pd.read_parquet(config.GOLD / "fato_leituras.parquet")
    fato = fato.sort_values(["estacao_id", "ts"]).reset_index(drop=True)
    # O treino e o teste usam só a série histórica. Leituras que chegaram ao
    # vivo (API/TinkerCad) são pontuadas, mas não entram na avaliação.
    historico = fato["origem"].isin(["historico", "imputado"])
    ini, fim = fato.loc[historico, "ts"].min(), fato.loc[historico, "ts"].max()
    corte = ini + (fim - ini) * 0.7
    fato["conjunto"] = np.select([~historico | (fato["ts"] > fim), fato["ts"] < corte],
                                 ["ao_vivo", "treino"], "teste")

    treino, teste = fato[fato["conjunto"] == "treino"], fato[fato["conjunto"] == "teste"]
    x_tr, y_tr = treino[features.COLUNAS_MODELO], treino["transbordo_2h"]
    x_te, y_te = teste[features.COLUNAS_MODELO], teste["transbordo_2h"]

    modelo = RandomForestClassifier(
        n_estimators=250,
        max_depth=10,
        min_samples_leaf=5,
        class_weight="balanced_subsample",  # transbordo é raro (~1,6% das leituras)
        random_state=config.SEMENTE,
        n_jobs=-1,
    )
    modelo.fit(x_tr, y_tr)

    prob_te = modelo.predict_proba(x_te)[:, 1]
    pred_te = (prob_te >= LIMIAR_ALERTA).astype(int)
    regra_te = teste["acima_alerta"].astype(int)  # prática atual: régua na cota de alerta

    # previsões para o período inteiro (o painel e o Power BI mostram as duas fases)
    fato["prob_transbordo"] = modelo.predict_proba(fato[features.COLUNAS_MODELO])[:, 1].round(4)
    fato["risco"] = [
        config.nivel_de_risco(p, n, c)
        for p, n, c in zip(fato["prob_transbordo"], fato["nivel_cm"], fato["cota_transbordo_cm"], strict=True)
    ]
    fato["alerta_regra"] = fato["acima_alerta"].astype(bool)

    def aplicar_histerese(liga: float) -> pd.Series:
        estado = pd.Series(False, index=fato.index)
        for _, idx in fato.groupby("estacao_id").groups.items():
            estado.loc[idx] = histerese(fato.loc[idx, "prob_transbordo"], liga=liga, desliga=config.LIMIAR_DESLIGA)
        return estado

    eventos = pd.read_parquet(config.GOLD / "fato_eventos.parquet")
    eventos = eventos.drop(columns=[c for c in eventos.columns if c.startswith(("antecedencia_", "ganho_"))
                                    or c == "conjunto"])
    eventos["conjunto"] = np.select([eventos["inicio"] > fim, eventos["inicio"] < corte],
                                    ["ao_vivo", "treino"], "teste")
    teste_full = fato[fato["conjunto"] == "teste"]
    semanas_teste = (teste["ts"].max() - teste["ts"].min()).days / 7

    def avaliar_regra(coluna: str) -> tuple[list[float], float]:
        antecedencias = [
            _antecedencia(fato[fato["estacao_id"] == ev.estacao_id], coluna, ev.inicio)
            for ev in eventos.itertuples()
        ]
        falsos = sum(_falsos_alarmes(g, coluna) for _, g in teste_full.groupby("estacao_id"))
        return antecedencias, falsos / semanas_teste

    # --- varredura de limiares: antecedência x falso alarme ----------------
    varredura = []
    mascara_teste = (eventos["conjunto"] == "teste").to_numpy()
    for liga in (0.5, 0.6, 0.7, 0.8, 0.9):
        fato["_alerta"] = aplicar_histerese(liga)
        teste_full = fato[fato["conjunto"] == "teste"]
        ant, fa = avaliar_regra("_alerta")
        ant_te = np.array(ant)[mascara_teste]
        varredura.append({"limiar": liga, "antecedencia_media_min": round(float(ant_te.mean()), 1),
                          "eventos_nao_antecipados": int((ant_te == 0).sum()),
                          "falsos_alarmes_por_semana": round(fa, 2)})
    fato = fato.drop(columns="_alerta")

    # --- os dois degraus em uso + a régua atual -----------------------------
    fato["prealerta_modelo"] = aplicar_histerese(config.LIMIAR_PREALERTA)
    fato["alerta_modelo"] = aplicar_histerese(LIMIAR_ALERTA)
    teste_full = fato[fato["conjunto"] == "teste"]
    ant_pre, fa_pre = avaliar_regra("prealerta_modelo")
    ant_mod, fa_mod = avaliar_regra("alerta_modelo")
    ant_reg, fa_reg = avaliar_regra("alerta_regra")
    eventos["antecedencia_prealerta_min"] = ant_pre
    eventos["antecedencia_modelo_min"] = ant_mod
    eventos["antecedencia_regra_min"] = ant_reg
    eventos["ganho_min"] = eventos["antecedencia_modelo_min"] - eventos["antecedencia_regra_min"]
    ev_te = eventos[eventos["conjunto"] == "teste"]

    metricas = {
        "modelo": "RandomForestClassifier",
        "alvo": "transbordo nas próximas 2 horas",
        "atributos": features.COLUNAS_MODELO,
        "divisao": {"corte": str(corte), "linhas_treino": int(len(treino)), "linhas_teste": int(len(teste)),
                    "positivos_treino": int(y_tr.sum()), "positivos_teste": int(y_te.sum())},
        "limiar_alerta_populacao": LIMIAR_ALERTA,
        "limiar_prealerta_defesa_civil": config.LIMIAR_PREALERTA,
        "teste_modelo": _metricas(y_te, pred_te, prob_te),
        "teste_regra_atual": _metricas(y_te, regra_te),
        "eventos_teste": int(len(ev_te)),
        "antecedencia_media_min": {
            "prealerta_defesa_civil": round(float(ev_te["antecedencia_prealerta_min"].mean()), 1),
            "alerta_populacao": round(float(ev_te["antecedencia_modelo_min"].mean()), 1),
            "regra_atual": round(float(ev_te["antecedencia_regra_min"].mean()), 1),
            "sem_sistema": 0.0,
        },
        "eventos_antecipados_60min_ou_mais": {
            "alerta_populacao": int((ev_te["antecedencia_modelo_min"] >= 60).sum()),
            "regra_atual": int((ev_te["antecedencia_regra_min"] >= 60).sum()),
        },
        "falsos_alarmes_por_semana": {
            "prealerta_defesa_civil": round(fa_pre, 2),
            "alerta_populacao": round(fa_mod, 2),
            "regra_atual": round(fa_reg, 2),
        },
        "varredura_limiares": varredura,
        "importancia_atributos": {
            c: round(float(v), 4)
            for c, v in sorted(zip(features.COLUNAS_MODELO, modelo.feature_importances_, strict=True),
                               key=lambda t: -t[1])
        },
    }

    config.MODELOS.mkdir(parents=True, exist_ok=True)
    joblib.dump(modelo, ARQUIVO_MODELO)
    (config.MODELOS / "metricas.json").write_text(json.dumps(metricas, indent=2, ensure_ascii=False),
                                                  encoding="utf-8")

    previsoes = fato[["estacao_id", "ts", "data", "conjunto", "nivel_cm", "prob_transbordo", "risco",
                      "prealerta_modelo", "alerta_modelo", "alerta_regra", "transbordo_2h"]]
    for nome, df in (("fato_previsoes", previsoes), ("fato_eventos", eventos)):
        df.to_parquet(config.GOLD / f"{nome}.parquet", index=False)
        df.to_csv(config.GOLD / f"{nome}.csv", index=False, sep=";", decimal=",", encoding="utf-8-sig")
    return metricas


if __name__ == "__main__":
    m = treinar()
    print(json.dumps({k: m[k] for k in ("teste_modelo", "teste_regra_atual", "antecedencia_media_min",
                                        "eventos_teste", "falsos_alarmes_por_semana")}, indent=2, ensure_ascii=False))
