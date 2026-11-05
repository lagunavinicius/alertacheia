"""Pipeline do Data Lake: bronze -> silver -> gold.

bronze      JSON Lines exatamente como chegaram (histórico, sensores via API,
            TinkerCad). Nunca é alterado: é a prova do que foi recebido.
silver      leitura validada, deduplicada, na grade de 15 min, com lacunas
            curtas interpoladas e marcadas. Registros inválidos vão para a
            quarentena com o motivo, e não são apagados.
gold        tabelas analíticas em modelo estrela, prontas para o Power BI,
            para o treino do modelo e para o painel da Defesa Civil.

Rodar:  python -m dados.pipeline
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from alertacheia import config, features

CAMPOS = ["estacao_id", "ts", "nivel_cm", "chuva_mm", "umidade_solo_pct", "origem"]
LACUNA_MAX_INTERPOLADA = 2  # até 30 min sem leitura é interpolado; mais que isso fica vazio


# --------------------------------------------------------------------------
# BRONZE -> SILVER
# --------------------------------------------------------------------------
def ler_bronze(pastas: list[Path] | None = None) -> pd.DataFrame:
    """Lê o histórico (bronze/leituras) e o que chegou em tempo real pela API
    ou pelo TinkerCad (bronze/tempo_real)."""
    pastas = pastas or [config.BRONZE / "leituras", config.BRONZE / "tempo_real"]
    arquivos = sorted(a for p in pastas if p.exists() for a in p.rglob("*.jsonl"))
    linhas: list[dict] = []
    for arquivo in arquivos:
        with open(arquivo, encoding="utf-8") as f:
            for numero, texto in enumerate(f, 1):
                texto = texto.strip()
                if not texto:
                    continue
                try:
                    registro = json.loads(texto)
                except json.JSONDecodeError:
                    registro = {"_erro_json": texto[:200]}
                registro["_arquivo"] = f"{arquivo.parent.name}/{arquivo.name}:{numero}"
                linhas.append(registro)
    df = pd.DataFrame(linhas)
    for campo in CAMPOS:
        if campo not in df.columns:
            df[campo] = None
    return df


def validar(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separa registros válidos e quarentena, com o motivo de cada rejeição."""
    df = df.copy()
    motivo = pd.Series("", index=df.index)

    def marcar(mascara: pd.Series, texto: str) -> None:
        motivo.loc[mascara & (motivo == "")] = texto

    if "_erro_json" in df.columns:
        marcar(df["_erro_json"].notna(), "json_invalido")
    marcar(~df["estacao_id"].isin(config.ESTACOES_POR_ID), "estacao_desconhecida")
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    marcar(df["ts"].isna(), "timestamp_invalido")
    for campo, (minimo, maximo) in (
        ("nivel_cm", config.FAIXA_NIVEL_CM),
        ("chuva_mm", config.FAIXA_CHUVA_MM),
        ("umidade_solo_pct", config.FAIXA_UMIDADE_PCT),
    ):
        df[campo] = pd.to_numeric(df[campo], errors="coerce")
        marcar(df[campo].isna(), f"{campo}_vazio")
        marcar((df[campo] < minimo) | (df[campo] > maximo), f"{campo}_fora_da_faixa")

    quarentena = df[motivo != ""].assign(motivo=motivo[motivo != ""])
    validos = df[motivo == ""]
    return validos, quarentena


def para_silver(validos: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    antes = len(validos)
    # mesma estação e mesmo instante = reenvio; fica a primeira chegada
    sem_dup = validos.drop_duplicates(subset=["estacao_id", "ts"], keep="first")
    duplicadas = antes - len(sem_dup)

    partes = []
    # Lacunas acima de 6 h viram segmentos separados (ex.: histórico de março
    # e leituras ao vivo de novembro): não se fabricam meses de "sem sinal".
    segmentos = []
    for est_id, grupo in sem_dup.groupby("estacao_id"):
        grupo = grupo.sort_values("ts")
        corte = (grupo["ts"].diff() > pd.Timedelta(hours=6)).cumsum()
        segmentos += [(est_id, seg) for _, seg in grupo.groupby(corte)]
    for est_id, grupo in segmentos:
        grupo = grupo.set_index("ts").sort_index()
        grupo.index = grupo.index.floor(f"{config.INTERVALO_MIN}min")
        grupo = grupo[~grupo.index.duplicated(keep="first")]
        grade = pd.date_range(grupo.index.min(), grupo.index.max(), freq=f"{config.INTERVALO_MIN}min")
        grupo = grupo.reindex(grade)
        faltante = grupo["nivel_cm"].isna()
        for campo in ("nivel_cm", "umidade_solo_pct"):
            grupo[campo] = grupo[campo].interpolate(limit=LACUNA_MAX_INTERPOLADA, limit_area="inside")
        # chuva não se interpola: sem leitura do pluviômetro, assume-se 0 só nas lacunas curtas
        grupo["chuva_mm"] = grupo["chuva_mm"].fillna(0.0, limit=LACUNA_MAX_INTERPOLADA)
        grupo["imputado"] = faltante & grupo["nivel_cm"].notna()
        grupo["sem_sinal"] = grupo["nivel_cm"].isna()
        grupo["estacao_id"] = est_id
        grupo["origem"] = grupo["origem"].fillna("imputado")
        partes.append(grupo.rename_axis("ts").reset_index())
    silver = pd.concat(partes, ignore_index=True)[
        ["estacao_id", "ts", "nivel_cm", "chuva_mm", "umidade_solo_pct", "origem", "imputado", "sem_sinal"]
    ]
    estat = {
        "duplicadas_removidas": int(duplicadas),
        "imputadas": int(silver["imputado"].sum()),
        "sem_sinal": int(silver["sem_sinal"].sum()),
    }
    return silver, estat


# --------------------------------------------------------------------------
# SILVER -> GOLD
# --------------------------------------------------------------------------
def dim_estacao() -> pd.DataFrame:
    return pd.DataFrame(config.ESTACOES)[
        ["estacao_id", "bairro", "corpo_dagua", "regiao", "lat", "lon",
         "nivel_base_cm", "cota_alerta_cm", "cota_transbordo_cm", "populacao_risco", "abrigo"]
    ]


def dim_calendario(inicio: pd.Timestamp, fim: pd.Timestamp) -> pd.DataFrame:
    dias = pd.date_range(inicio.normalize(), fim.normalize(), freq="D")
    nomes_mes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    nomes_dia = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
    return pd.DataFrame({
        "data": dias.date,
        "ano": dias.year,
        "mes": dias.month,
        "mes_nome": [nomes_mes[m - 1] for m in dias.month],
        "ano_mes": dias.strftime("%Y-%m"),
        "dia_semana": [nomes_dia[d] for d in dias.day_of_week],
        "semana_ano": dias.isocalendar().week.values,
        "fim_de_semana": dias.day_of_week >= 5,
    })


def fato_leituras(silver: pd.DataFrame) -> pd.DataFrame:
    base = silver[~silver["sem_sinal"]].copy()
    base = features.calcular(base)
    base["transbordo_2h"] = features.rotular_transbordo_futuro(base)
    cotas = dim_estacao().set_index("estacao_id")
    base["cota_alerta_cm"] = base["estacao_id"].map(cotas["cota_alerta_cm"])
    base["acima_alerta"] = base["nivel_cm"] >= base["cota_alerta_cm"]
    base["acima_transbordo"] = base["nivel_cm"] >= base["cota_transbordo_cm"]
    base["data"] = base["ts"].dt.date
    base["hora"] = base["ts"].dt.hour
    return base


def fato_hora(fato: pd.DataFrame) -> pd.DataFrame:
    fato = fato.assign(ts_hora=fato["ts"].dt.floor("h"))
    agg = fato.groupby(["estacao_id", "ts_hora"]).agg(
        nivel_max_cm=("nivel_cm", "max"),
        nivel_medio_cm=("nivel_cm", "mean"),
        chuva_mm=("chuva_mm", "sum"),
        umidade_media_pct=("umidade_solo_pct", "mean"),
        minutos_acima_transbordo=("acima_transbordo", lambda s: int(s.sum()) * config.INTERVALO_MIN),
    ).reset_index()
    agg["data"] = agg["ts_hora"].dt.date
    numericas = agg.select_dtypes("number").columns
    agg[numericas] = agg[numericas].round(2)
    return agg


def fato_eventos(fato: pd.DataFrame) -> pd.DataFrame:
    """Cada transbordo vira um evento: início, pico, duração e chuva associada."""
    eventos = []
    pop = dim_estacao().set_index("estacao_id")["populacao_risco"]
    for est_id, g in fato.groupby("estacao_id"):
        g = g.sort_values("ts").reset_index(drop=True)
        acima = g["acima_transbordo"].astype(bool)
        inicio_idx = g.index[acima & ~acima.shift(1, fill_value=False)]
        for i in inicio_idx:
            j = i
            while j + 1 < len(g) and acima.iloc[j + 1]:
                j += 1
            trecho = g.iloc[i: j + 1]
            janela_chuva = g[(g["ts"] >= g.loc[i, "ts"] - pd.Timedelta(hours=3)) & (g["ts"] <= g.loc[j, "ts"])]
            eventos.append({
                "evento_id": f"{est_id}-{g.loc[i, 'ts']:%Y%m%d%H%M}",
                "estacao_id": est_id,
                "inicio": g.loc[i, "ts"],
                "fim": g.loc[j, "ts"],
                "data": g.loc[i, "ts"].date(),
                "duracao_min": (j - i + 1) * config.INTERVALO_MIN,
                "nivel_pico_cm": float(trecho["nivel_cm"].max()),
                "chuva_evento_mm": round(float(janela_chuva["chuva_mm"].sum()), 1),
                "populacao_exposta": int(pop[est_id]),
            })
    return pd.DataFrame(eventos)


def fato_qualidade(bronze: pd.DataFrame, quarentena: pd.DataFrame, silver: pd.DataFrame) -> pd.DataFrame:
    b = bronze.assign(data=pd.to_datetime(bronze["ts"], errors="coerce").dt.date)
    recebidas = b.groupby(["estacao_id", "data"]).size().rename("recebidas")
    q = quarentena.assign(data=quarentena["ts"].dt.date)
    rejeitadas = q.groupby(["estacao_id", "data"]).size().rename("quarentena")
    s = silver.assign(data=silver["ts"].dt.date)
    agg = s.groupby(["estacao_id", "data"]).agg(
        validas=("imputado", lambda x: int((~x).sum())),
        imputadas=("imputado", "sum"),
        sem_sinal=("sem_sinal", "sum"),
    )
    out = pd.concat([recebidas, rejeitadas, agg], axis=1).fillna(0).astype(int).reset_index()
    esperado = 24 * config.LEITURAS_POR_HORA
    out["completude_pct"] = (100 * (out["validas"] + out["imputadas"]) / esperado).clip(upper=100).round(1)
    return out


def _gravar(df: pd.DataFrame, nome: str, pasta: Path, csv: bool = True) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    df.to_parquet(pasta / f"{nome}.parquet", index=False)
    if csv:
        # CSV com ; e vírgula decimal abre direto no Power BI / Excel em pt-BR
        df.to_csv(pasta / f"{nome}.csv", index=False, sep=";", decimal=",", encoding="utf-8-sig")


def executar() -> dict:
    bronze = ler_bronze()
    validos, quarentena = validar(bronze)
    silver, estat = para_silver(validos)

    _gravar(quarentena.drop(columns=[c for c in quarentena.columns if c.startswith("_erro")], errors="ignore"),
            "leituras_rejeitadas", config.QUARENTENA)
    _gravar(silver, "leituras", config.SILVER, csv=False)

    fato = fato_leituras(silver)
    base_cols = ["estacao_id", "ts", "data", "hora", "nivel_cm", "chuva_mm", "umidade_solo_pct", "origem", "imputado"]
    colunas_fato = [*base_cols, *[c for c in features.COLUNAS_MODELO if c not in base_cols],
                    "cota_alerta_cm", "cota_transbordo_cm", "acima_alerta", "acima_transbordo", "transbordo_2h"]
    _gravar(fato[colunas_fato], "fato_leituras", config.GOLD)
    _gravar(fato_hora(fato), "fato_leituras_hora", config.GOLD)
    eventos = fato_eventos(fato)
    _gravar(eventos, "fato_eventos", config.GOLD)
    _gravar(fato_qualidade(bronze, quarentena, silver), "fato_qualidade", config.GOLD)
    _gravar(dim_estacao(), "dim_estacao", config.GOLD)
    _gravar(dim_calendario(silver["ts"].min(), silver["ts"].max()), "dim_calendario", config.GOLD)

    resumo = {
        "bronze_recebidas": int(len(bronze)),
        "quarentena": int(len(quarentena)),
        "motivos_quarentena": quarentena["motivo"].value_counts().to_dict(),
        **estat,
        "silver_linhas": int(len(silver)),
        "gold_fato_leituras": int(len(fato)),
        "eventos_transbordo": int(len(eventos)),
        "positivos_transbordo_2h": int(fato["transbordo_2h"].sum()),
    }
    (config.GOLD / "_resumo_pipeline.json").write_text(json.dumps(resumo, indent=2, ensure_ascii=False, default=str),
                                                       encoding="utf-8")
    return resumo


if __name__ == "__main__":
    print(json.dumps(executar(), indent=2, ensure_ascii=False, default=str))
