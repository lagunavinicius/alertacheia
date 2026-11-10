"""Agente que redige o alerta ao morador (IA generativa + fallback).

Dois modos, com a mesma saída estruturada:

* claude: com ANTHROPIC_API_KEY no .env, chama o modelo via API Anthropic
  com saída JSON garantida por esquema (output_config.format);
* determinístico: sem chave, ou se a chamada falhar, redige por regras.
  Enchente não espera a internet voltar, e o alerta sai do mesmo jeito.

O modo usado vai junto no alerta (campo "gerado_por"): o painel e o PDF
mostram sempre de onde veio o texto.

Rodar:  python -m ia.alerta_generativo                   (exemplo com dados reais do lago)
        python -m ia.alerta_generativo --deterministico  (força o fallback)
"""

from __future__ import annotations

import argparse
import json
import logging
import time

from alertacheia import config
from ia import prompts

log = logging.getLogger("alertacheia.ia")

LIMITE_SMS = 160


def montar_contexto(estacao_id: str, risco: str, probabilidade: float, nivel_cm: float,
                    chuva_1h: float, motivos: list[str], mobilidade_reduzida: bool = False) -> dict:
    est = config.ESTACOES_POR_ID[estacao_id]
    return {
        "bairro": est["bairro"],
        "corpo_dagua": est["corpo_dagua"],
        "risco": risco,
        "chance_de_transbordar_2h": f"{probabilidade:.0%}",
        "nivel_atual_em_relacao_ao_limite": f"{nivel_cm / est['cota_transbordo_cm']:.0%}",
        "chuva_ultima_hora_mm": round(chuva_1h, 1),
        "motivos": motivos,
        "abrigo": est["abrigo"],
        "telefone_defesa_civil": config.TELEFONE_DEFESA_CIVIL,
        "telefone_bombeiros": config.TELEFONE_BOMBEIROS,
        "ha_moradores_com_mobilidade_reduzida": mobilidade_reduzida,
    }


def redigir_deterministico(ctx: dict) -> dict:
    bairro, abrigo, tel = ctx["bairro"], ctx["abrigo"], ctx["telefone_defesa_civil"]
    risco = ctx["risco"]
    if risco == "EMERGENCIA":
        titulo = f"EMERGÊNCIA: enchente em {bairro}"
        sms = (f"DEFESA CIVIL: {ctx['corpo_dagua']} transbordando em {bairro}. "
               f"Saia agora para {abrigo} ou lugar alto. Ligue {tel}.")
        acoes = [f"Saia agora para {abrigo} ou para um lugar alto",
                 "Não atravesse água corrente, nem a pé nem de carro",
                 "Desligue a energia elétrica se for seguro",
                 f"Em perigo, ligue {tel} ou {ctx['telefone_bombeiros']}"]
    elif risco == "ALERTA":
        titulo = f"ALERTA de enchente em {bairro}"
        sms = (f"DEFESA CIVIL: risco alto de enchente em {bairro} nas próximas 2h. "
               f"Saia dos cômodos baixos, leve documentos. Abrigo: {abrigo}. {tel}")
        acoes = ["Tire pessoas e animais dos cômodos baixos",
                 "Separe documentos, remédios e carregador",
                 f"Se a água subir, vá para {abrigo}",
                 "Fique longe da beira do córrego"]
    else:
        titulo = f"Atenção: chuva forte em {bairro}"
        sms = f"DEFESA CIVIL: chuva forte em {bairro}. Fique atento ao córrego e prepare documentos e remédios. Dúvidas: {tel}."
        acoes = ["Fique atento ao nível do córrego",
                 "Deixe documentos e remédios em saco plástico",
                 "Evite passar perto do córrego"]
    if ctx.get("ha_moradores_com_mobilidade_reduzida"):
        acoes.insert(1, f"Quem tem dificuldade para andar: peça ajuda a um vizinho agora ou ligue {tel}")
    motivo = ctx["motivos"][0] if ctx.get("motivos") else "a chuva está forte"
    # quando a primeira ação já cita o abrigo (EMERGÊNCIA), não repetir o nome dele na mesma mensagem
    abrigo_extra = "" if abrigo in acoes[0] else f" O abrigo mais próximo é {abrigo}."
    mensagem = f"O sistema percebeu que {motivo}. {acoes[0]}.{abrigo_extra}"
    audio = (f"{titulo}. {mensagem}".replace(f"ligue {tel}", f"ligue {' '.join(tel)}")
             .replace(" cm ", " centímetros ").replace(" mm ", " milímetros ")
             .replace("2h", "duas horas"))
    return {"titulo": titulo[:40], "sms": sms[:LIMITE_SMS], "mensagem": mensagem,
            "acoes": acoes, "texto_audio": audio}


def _chamar_claude(ctx: dict) -> dict:
    from anthropic import Anthropic

    cliente = Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=20.0, max_retries=1)
    resposta = cliente.messages.create(
        model=config.MODELO_IA,
        max_tokens=2048,
        system=prompts.SISTEMA,
        messages=[{"role": "user", "content": prompts.montar_usuario(ctx)}],
        # texto curto e de baixa complexidade: esforço baixo = mais rápido e barato
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": prompts.ESQUEMA_SAIDA}},
    )
    if resposta.stop_reason == "refusal":
        raise RuntimeError("o modelo recusou o pedido")
    texto = next(b.text for b in resposta.content if b.type == "text")
    saida = json.loads(texto)
    saida["sms"] = saida["sms"][:LIMITE_SMS]
    return saida


def gerar_alerta(ctx: dict, forcar_deterministico: bool = False) -> dict:
    inicio = time.perf_counter()
    if config.ANTHROPIC_API_KEY and not forcar_deterministico:
        try:
            saida = _chamar_claude(ctx)
            saida["gerado_por"] = f"claude ({config.MODELO_IA})"
        except Exception as erro:  # noqa: BLE001 - qualquer falha cai no fallback
            log.warning("IA generativa indisponível (%s); usando gerador determinístico", type(erro).__name__)
            saida = redigir_deterministico(ctx)
            saida["gerado_por"] = f"deterministico (falha na IA: {type(erro).__name__})"
    else:
        saida = redigir_deterministico(ctx)
        saida["gerado_por"] = "deterministico"
    saida["tempo_geracao_ms"] = round((time.perf_counter() - inicio) * 1000)
    return saida


def _exemplo() -> dict:
    """Pega o momento de maior risco do conjunto de teste para demonstrar."""
    import pandas as pd

    from alertacheia import features
    from ia import modelo

    fato = pd.read_parquet(config.GOLD / "fato_leituras.parquet")
    prev = pd.read_parquet(config.GOLD / "fato_previsoes.parquet")
    df = fato.merge(prev[["estacao_id", "ts", "prob_transbordo", "risco", "conjunto"]], on=["estacao_id", "ts"])
    df = df[(df["conjunto"] == "teste") & (df["risco"] == "ALERTA")]
    linha = df.sort_values("prob_transbordo").iloc[len(df) // 2]
    return montar_contexto(linha["estacao_id"], linha["risco"], float(linha["prob_transbordo"]),
                           float(linha["nivel_cm"]), float(linha["chuva_1h"]),
                           modelo.explicar(linha[features.COLUNAS_MODELO]), mobilidade_reduzida=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--deterministico", action="store_true")
    args = parser.parse_args()
    contexto = _exemplo()
    print("ENTRADA:\n" + json.dumps(contexto, ensure_ascii=False, indent=2))
    print("\nSAÍDA:\n" + json.dumps(gerar_alerta(contexto, args.deterministico), ensure_ascii=False, indent=2))
