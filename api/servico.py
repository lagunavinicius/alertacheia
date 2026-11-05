"""Regras de negócio da API: o caminho de uma leitura até o alerta.

    sensor -> POST /api/leituras -> validação -> banco + bronze do Data Lake
           -> atributos (mesma função do treino) -> modelo de risco
           -> máquina de estados com histerese -> pré-alerta (Defesa Civil)
                                                -> alerta (IA generativa + SMS)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from alertacheia import config, features, hidrologia
from api import seguranca
from api.banco import Banco
from ia import alerta_generativo, modelo

log = logging.getLogger("alertacheia.servico")
JANELA_ATRIBUTOS = 24 * config.LEITURAS_POR_HORA + 1   # 24 h de leituras para a chuva acumulada
ORDEM_RISCO = {"NORMAL": 0, "ATENCAO": 1, "ALERTA": 2, "EMERGENCIA": 3}


def agora() -> datetime:
    return datetime.now().replace(second=0, microsecond=0)


def auditar(banco: Banco, ator: str, acao: str, detalhe: str = "") -> None:
    with banco.transacao() as con:
        con.execute("INSERT INTO auditoria (ts, ator, acao, detalhe) VALUES (?,?,?,?)",
                    (agora().isoformat(), ator, acao, detalhe[:500]))


# --------------------------------------------------------------------------
# Carga inicial: estado "ao vivo" a partir do histórico
# --------------------------------------------------------------------------
def semear_estado_inicial(banco: Banco) -> int:
    """Se o banco estiver vazio, copia as últimas 48 h da silver para o
    presente, para a demonstração começar com 24 h de chuva acumulada
    disponíveis. Sem isso, a primeira leitura teria atributos incompletos."""
    if banco.um("SELECT 1 AS x FROM leituras LIMIT 1"):
        return 0
    arquivo = config.SILVER / "leituras.parquet"
    if not arquivo.exists():
        log.warning("silver ausente; rode `python run_pipeline.py` para semear o estado inicial")
        return 0
    silver = pd.read_parquet(arquivo)
    silver = silver[~silver["sem_sinal"] & silver["origem"].isin(["historico", "imputado"])]
    fim = silver["ts"].max()
    janela = silver[silver["ts"] > fim - timedelta(hours=48)].copy()
    deslocamento = pd.Timestamp(agora()).floor(f"{config.INTERVALO_MIN}min") - fim
    janela["ts"] = janela["ts"] + deslocamento
    janela = features.calcular(janela)
    janela["prob"] = modelo.prever_probabilidade(janela).round(4)
    recebido = agora().isoformat()
    with banco.transacao() as con:
        con.executemany(
            "INSERT OR IGNORE INTO leituras (estacao_id, ts, nivel_cm, chuva_mm, umidade_solo_pct, origem, "
            "prob_transbordo, risco, recebido_em) VALUES (?,?,?,?,?,?,?,?,?)",
            [(r.estacao_id, r.ts.isoformat(timespec="minutes"), r.nivel_cm, r.chuva_mm, r.umidade_solo_pct,
              "historico", r.prob, config.nivel_de_risco(r.prob, r.nivel_cm, r.cota_transbordo_cm), recebido)
             for r in janela.itertuples()],
        )
        for est in config.ESTACOES:
            con.execute("INSERT OR IGNORE INTO estado_estacao (estacao_id) VALUES (?)", (est["estacao_id"],))
    return len(janela)


# --------------------------------------------------------------------------
# Ingestão
# --------------------------------------------------------------------------
def _gravar_bronze(leitura: dict) -> None:
    """Toda leitura em tempo real também entra no Data Lake, sem alteração."""
    pasta = config.BRONZE / "tempo_real" / f"data={leitura['ts'][:10]}"
    pasta.mkdir(parents=True, exist_ok=True)
    with open(pasta / f"{leitura['estacao_id']}.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(leitura, ensure_ascii=False) + "\n")


def ultimas_leituras(banco: Banco, estacao_id: str, limite: int = JANELA_ATRIBUTOS) -> pd.DataFrame:
    linhas = banco.consultar(
        "SELECT * FROM (SELECT * FROM leituras WHERE estacao_id = ? ORDER BY ts DESC LIMIT ?) ORDER BY ts",
        (estacao_id, limite))
    df = pd.DataFrame(linhas)
    if not df.empty:
        df["ts"] = pd.to_datetime(df["ts"])
    return df


def registrar_leitura(banco: Banco, dados: dict) -> dict:
    """Grava a leitura, calcula o risco e dispara os alertas. Devolve o estado."""
    est = config.ESTACOES_POR_ID[dados["estacao_id"]]
    registro = {**dados, "ts": dados["ts"].isoformat(timespec="minutes")}
    with banco.transacao() as con:
        cur = con.execute(
            "INSERT OR IGNORE INTO leituras (estacao_id, ts, nivel_cm, chuva_mm, umidade_solo_pct, origem, recebido_em)"
            " VALUES (?,?,?,?,?,?,?)",
            (registro["estacao_id"], registro["ts"], registro["nivel_cm"], registro["chuva_mm"],
             registro["umidade_solo_pct"], registro["origem"], agora().isoformat()))
        duplicada = cur.rowcount == 0
    if duplicada:
        return {"duplicada": True, "estacao_id": registro["estacao_id"], "ts": registro["ts"]}
    _gravar_bronze({**registro, "recebido_em": agora().isoformat()})

    janela = features.calcular(ultimas_leituras(banco, est["estacao_id"]))
    atual = janela[janela["ts"] == pd.Timestamp(registro["ts"])].iloc[-1]
    prob = float(modelo.prever_probabilidade(atual.to_frame().T).iloc[0])
    risco = config.nivel_de_risco(prob, atual["nivel_cm"], est["cota_transbordo_cm"])
    with banco.transacao() as con:
        con.execute("UPDATE leituras SET prob_transbordo = ?, risco = ? WHERE estacao_id = ? AND ts = ?",
                    (round(prob, 4), risco, registro["estacao_id"], registro["ts"]))

    eventos = _atualizar_estado(banco, est, atual, prob, risco)
    return {"duplicada": False, "estacao_id": est["estacao_id"], "ts": registro["ts"],
            "prob_transbordo": round(prob, 4), "risco": risco, "eventos": eventos}


def _atualizar_estado(banco: Banco, est: dict, atual: pd.Series, prob: float, risco: str) -> list[str]:
    """Máquina de estados com histerese (a mesma regra avaliada no treino)."""
    estado = banco.um("SELECT * FROM estado_estacao WHERE estacao_id = ?", (est["estacao_id"],))
    if estado is None:
        with banco.transacao() as con:
            con.execute("INSERT INTO estado_estacao (estacao_id) VALUES (?)", (est["estacao_id"],))
        estado = {"prealerta_ativo": 0, "alerta_ativo": 0, "leituras_abaixo": 0, "risco_alerta": None}

    eventos: list[str] = []
    pre, ale, abaixo, risco_alerta = (bool(estado["prealerta_ativo"]), bool(estado["alerta_ativo"]),
                                      estado["leituras_abaixo"], estado["risco_alerta"])
    abaixo = abaixo + 1 if prob < config.LIMIAR_DESLIGA and risco != "EMERGENCIA" else 0

    if not pre and prob >= config.LIMIAR_PREALERTA:
        pre = True
        _emitir_alerta(banco, est, atual, prob, "ATENCAO", publico="defesa_civil")
        eventos.append("prealerta_defesa_civil")

    nivel_ordem = ORDEM_RISCO[risco]
    if nivel_ordem >= ORDEM_RISCO["ALERTA"] and (not ale or nivel_ordem > ORDEM_RISCO.get(risco_alerta or "NORMAL", 0)):
        # novo alerta, ou escalada de ALERTA para EMERGENCIA
        ale, risco_alerta = True, risco
        _emitir_alerta(banco, est, atual, prob, risco, publico="populacao")
        eventos.append(f"alerta_populacao_{risco.lower()}")

    if (pre or ale) and abaixo >= config.LEITURAS_POR_HORA:
        pre = ale = False
        risco_alerta = None
        with banco.transacao() as con:
            con.execute("UPDATE alertas SET status = 'encerrado', encerrado_em = ? "
                        "WHERE estacao_id = ? AND status = 'ativo'", (agora().isoformat(), est["estacao_id"]))
        eventos.append("alertas_encerrados")

    with banco.transacao() as con:
        con.execute("UPDATE estado_estacao SET prealerta_ativo = ?, alerta_ativo = ?, leituras_abaixo = ?, "
                    "risco_alerta = ? WHERE estacao_id = ?",
                    (int(pre), int(ale), abaixo, risco_alerta, est["estacao_id"]))
    return eventos


def _emitir_alerta(banco: Banco, est: dict, atual: pd.Series, prob: float, risco: str, publico: str) -> int:
    motivos = modelo.explicar(atual)
    mobilidade = bool(banco.um(
        "SELECT 1 AS x FROM moradores WHERE estacao_id = ? AND mobilidade_reduzida = 1 LIMIT 1",
        (est["estacao_id"],)))
    ctx = alerta_generativo.montar_contexto(est["estacao_id"], risco, prob, float(atual["nivel_cm"]),
                                            float(atual["chuva_1h"]), motivos, mobilidade)
    texto = alerta_generativo.gerar_alerta(ctx)
    with banco.transacao() as con:
        cur = con.execute(
            "INSERT INTO alertas (estacao_id, publico, risco, prob_transbordo, nivel_cm, ts_leitura, criado_em, "
            "titulo, sms, mensagem, acoes, texto_audio, motivos, gerado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (est["estacao_id"], publico, risco, round(prob, 4), float(atual["nivel_cm"]),
             atual["ts"].isoformat(timespec="minutes"), agora().isoformat(), texto["titulo"], texto["sms"],
             texto["mensagem"], json.dumps(texto["acoes"], ensure_ascii=False), texto["texto_audio"],
             json.dumps(motivos, ensure_ascii=False), texto["gerado_por"]))
        alerta_id = cur.lastrowid
    if publico == "populacao":
        enviados = notificar_moradores(banco, est["estacao_id"], texto["sms"])
        with banco.transacao() as con:
            con.execute("UPDATE alertas SET destinatarios = ? WHERE id = ?", (enviados, alerta_id))
    log.info("alerta %s emitido: %s %s (%s)", alerta_id, est["estacao_id"], risco, publico)
    return alerta_id


def notificar_moradores(banco: Banco, estacao_id: str, sms: str) -> int:
    """Gateway de SMS simulado: decifra o telefone só no momento do envio e
    registra o disparo com o número mascarado."""
    moradores = banco.consultar("SELECT telefone_cifrado, telefone_final FROM moradores WHERE estacao_id = ?",
                                (estacao_id,))
    registro = config.BANCO.parent / "sms_enviados.log"
    registro.parent.mkdir(parents=True, exist_ok=True)
    with open(registro, "a", encoding="utf-8") as f:
        for m in moradores:
            _numero = seguranca.decifrar(m["telefone_cifrado"])  # o que iria para a operadora
            f.write(f"{agora().isoformat()} | {seguranca.mascarar_telefone(m['telefone_final'])} | {sms}\n")
    return len(moradores)


# --------------------------------------------------------------------------
# Leitura do estado atual
# --------------------------------------------------------------------------
def estado_estacoes(banco: Banco) -> list[dict]:
    saida = []
    for est in config.ESTACOES:
        ultima = banco.um("SELECT ts, nivel_cm, chuva_mm, umidade_solo_pct, prob_transbordo, risco, origem "
                          "FROM leituras WHERE estacao_id = ? ORDER BY ts DESC LIMIT 1", (est["estacao_id"],))
        chuva_1h = banco.um("SELECT COALESCE(SUM(chuva_mm),0) AS c FROM (SELECT chuva_mm FROM leituras "
                            "WHERE estacao_id = ? ORDER BY ts DESC LIMIT ?)",
                            (est["estacao_id"], config.LEITURAS_POR_HORA))
        alerta = banco.um("SELECT * FROM alertas WHERE estacao_id = ? AND publico = 'populacao' AND status = 'ativo' "
                          "ORDER BY id DESC LIMIT 1", (est["estacao_id"],))
        if ultima:
            ultima["chuva_1h_mm"] = round(chuva_1h["c"], 1)
            ultima["pct_transbordo"] = round(ultima["nivel_cm"] / est["cota_transbordo_cm"], 3)
        saida.append({**{k: est[k] for k in ("estacao_id", "bairro", "corpo_dagua", "regiao", "lat", "lon",
                                             "cota_alerta_cm", "cota_transbordo_cm", "abrigo", "populacao_risco")},
                      "ultima_leitura": ultima, "alerta_ativo": _formatar_alerta(alerta) if alerta else None})
    return saida


def _formatar_alerta(a: dict) -> dict:
    a = dict(a)
    a["acoes"] = json.loads(a["acoes"])
    a["motivos"] = json.loads(a["motivos"])
    a["bairro"] = config.ESTACOES_POR_ID[a["estacao_id"]]["bairro"]
    return a


def listar_alertas(banco: Banco, estacao_id: str | None, publico: str | None, limite: int) -> list[dict]:
    sql, params = "SELECT * FROM alertas WHERE 1=1", []
    if estacao_id:
        sql += " AND estacao_id = ?"
        params.append(estacao_id)
    if publico:
        sql += " AND publico = ?"
        params.append(publico)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limite)
    return [_formatar_alerta(a) for a in banco.consultar(sql, tuple(params))]


def serie(banco: Banco, estacao_id: str, horas: int) -> list[dict]:
    df = ultimas_leituras(banco, estacao_id, horas * config.LEITURAS_POR_HORA)
    if df.empty:
        return []
    df["ts"] = df["ts"].dt.strftime("%Y-%m-%dT%H:%M")
    return df[["ts", "nivel_cm", "chuva_mm", "umidade_solo_pct", "prob_transbordo", "risco", "origem"]] \
        .replace({np.nan: None}).to_dict("records")


# --------------------------------------------------------------------------
# Cenário de demonstração (mesma física do gerador histórico)
# --------------------------------------------------------------------------
def leituras_de_cenario(banco: Banco, estacao_id: str, cenario: str, passos: int) -> list[dict]:
    est = config.ESTACOES_POR_ID[estacao_id]
    hist = ultimas_leituras(banco, estacao_id, 16)
    if hist.empty:
        raise ValueError("estação sem leituras")
    rng = np.random.default_rng()
    return hidrologia.continuar_serie(
        est, list(hist["chuva_mm"]), float(hist["nivel_cm"].iloc[-1]), float(hist["umidade_solo_pct"].iloc[-1]),
        hist["ts"].iloc[-1].to_pydatetime(), hidrologia.perfil_chuva(cenario, passos, rng), rng, origem="demo")


# --------------------------------------------------------------------------
# Painel analítico (camada gold)
# --------------------------------------------------------------------------
class Gold:
    """Tabelas gold carregadas uma vez; recarrega se o pipeline rodar de novo."""

    def __init__(self):
        self._carimbo = None
        self.carregar()

    def carregar(self) -> None:
        arq = config.GOLD / "fato_eventos.parquet"
        if not arq.exists():
            self.disponivel = False
            return
        carimbo = arq.stat().st_mtime
        if carimbo == self._carimbo:
            return
        self.eventos = pd.read_parquet(arq)
        self.hora = pd.read_parquet(config.GOLD / "fato_leituras_hora.parquet")
        self.qualidade = pd.read_parquet(config.GOLD / "fato_qualidade.parquet")
        metricas = config.MODELOS / "metricas.json"
        self.metricas = json.loads(metricas.read_text(encoding="utf-8")) if metricas.exists() else {}
        self.disponivel, self._carimbo = True, carimbo


def _filtrar(df: pd.DataFrame, col_data: str, estacao_id, inicio, fim) -> pd.DataFrame:
    datas = pd.to_datetime(df[col_data])
    m = pd.Series(True, index=df.index)
    if estacao_id:
        m &= df["estacao_id"] == estacao_id
    if inicio:
        m &= datas >= pd.Timestamp(inicio)
    if fim:
        m &= datas <= pd.Timestamp(fim)
    return df[m]


def painel_resumo(gold: Gold, banco: Banco, estacao_id: str | None, inicio, fim) -> dict:
    gold.carregar()
    ev = _filtrar(gold.eventos, "data", estacao_id, inicio, fim)
    hr = _filtrar(gold.hora, "data", estacao_id, inicio, fim)
    ql = _filtrar(gold.qualidade, "data", estacao_id, inicio, fim)
    # "? IS NULL OR ..." deixa a consulta fixa e parametrizada com ou sem filtro
    alertas = banco.um("SELECT COUNT(*) AS n, COALESCE(SUM(destinatarios),0) AS d FROM alertas "
                       "WHERE publico = 'populacao' AND (? IS NULL OR estacao_id = ?)", (estacao_id, estacao_id))
    moradores = banco.um("SELECT COUNT(*) AS n FROM moradores WHERE (? IS NULL OR estacao_id = ?)",
                         (estacao_id, estacao_id))

    # chuva: média entre as estações (somar bairros inflaria o número);
    # nível: % da cota de transbordo, para comparar córregos de tamanhos diferentes
    cotas = {e["estacao_id"]: e["cota_transbordo_cm"] for e in config.ESTACOES}
    hr = hr.assign(nivel_pct=hr["nivel_max_cm"] / hr["estacao_id"].map(cotas) * 100)
    por_dia_est = hr.groupby(["data", "estacao_id"]).agg(
        chuva_mm=("chuva_mm", "sum"), nivel_max_pct=("nivel_pct", "max"),
        minutos_acima=("minutos_acima_transbordo", "sum")).reset_index()
    diario = por_dia_est.groupby("data").agg(chuva_mm=("chuva_mm", "mean"), nivel_max_pct=("nivel_max_pct", "max"),
                                             minutos_acima=("minutos_acima", "sum")).round(1).reset_index()
    n_estacoes = max(1, hr["estacao_id"].nunique())
    ev_dia = ev.groupby("data").size().rename("eventos")
    diario = diario.merge(ev_dia, left_on="data", right_index=True, how="left").fillna({"eventos": 0})
    diario["data"] = diario["data"].astype(str)

    por_estacao = []
    for est in config.ESTACOES:
        if estacao_id and est["estacao_id"] != estacao_id:
            continue
        e = ev[ev["estacao_id"] == est["estacao_id"]]
        h = hr[hr["estacao_id"] == est["estacao_id"]]
        por_estacao.append({
            "estacao_id": est["estacao_id"], "bairro": est["bairro"], "eventos": int(len(e)),
            "horas_acima_transbordo": round(float(h["minutos_acima_transbordo"].sum()) / 60, 1),
            "chuva_mm": round(float(h["chuva_mm"].sum()), 1),
            "antecedencia_media_min": round(float(e["antecedencia_modelo_min"].mean()), 1) if len(e) else None,
        })

    def media(col):
        return round(float(ev[col].mean()), 1) if len(ev) else None

    return {
        "filtros": {"estacao_id": estacao_id, "inicio": str(inicio) if inicio else None,
                    "fim": str(fim) if fim else None},
        "indicadores": {
            "eventos_transbordo": int(len(ev)),
            "antecedencia_media_modelo_min": media("antecedencia_modelo_min"),
            "antecedencia_media_regra_min": media("antecedencia_regra_min"),
            "ganho_medio_min": media("ganho_min"),
            "horas_acima_transbordo": round(float(hr["minutos_acima_transbordo"].sum()) / 60, 1),
            "chuva_media_estacao_mm": round(float(hr["chuva_mm"].sum()) / n_estacoes, 1),
            "pessoas_expostas": int(ev["populacao_exposta"].sum()) if len(ev) else 0,
            "completude_dados_pct": round(float(ql["completude_pct"].mean()), 1) if len(ql) else None,
            "alertas_emitidos_ao_vivo": int(alertas["n"]),
            "sms_enviados_ao_vivo": int(alertas["d"]),
            "moradores_cadastrados": int(moradores["n"]),
        },
        "serie_diaria": diario.to_dict("records"),
        "por_estacao": por_estacao,
        "eventos": ev.sort_values("inicio", ascending=False).head(50).assign(
            inicio=lambda d: d["inicio"].astype(str), fim=lambda d: d["fim"].astype(str),
            data=lambda d: d["data"].astype(str))[[
                "evento_id", "estacao_id", "inicio", "duracao_min", "nivel_pico_cm", "chuva_evento_mm",
                "antecedencia_modelo_min", "antecedencia_regra_min", "conjunto"]].to_dict("records"),
        "periodo_disponivel": {"inicio": str(gold.hora["data"].min()), "fim": str(gold.hora["data"].max())},
    }
