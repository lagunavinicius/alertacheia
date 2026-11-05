"""Física simplificada do córrego, compartilhada por todos os simuladores.

O gerador histórico, o cenário de demonstração da API e o simulador IoT
usam as mesmas equações, então uma "tempestade" de demonstração se comporta
como as tempestades em que o modelo foi treinado.

    escoamento(t) = chuva(t) x sensibilidade do bairro x fator do solo
    fator do solo = 0,35 + 1,1 x (umidade/100)^2   (solo encharcado escoa mais)
    a água chega ao córrego distribuída por um hidrograma unitário (~45-60 min)
    nível(t)      = base + água acumulada (que escoa 4,5% a cada 15 min)
    acima da cota de transbordo a água espalha pela várzea e sobe mais devagar
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import numpy as np

from alertacheia import config

GANHO_CM = 2.1        # cm de subida por mm de escoamento efetivo (calibrado)
RECESSAO = 0.955      # fração da água acumulada que permanece a cada 15 min
ESPRAIAMENTO = 0.3    # acima da cota, a subida vale 30%
KERNEL = np.array([t * np.exp(-t / 2.6) for t in range(1, 14)])
KERNEL = KERNEL / KERNEL.sum()


def fator_solo(umidade: float) -> float:
    return 0.35 + 1.1 * (umidade / 100.0) ** 2


def atualizar_umidade(umidade: float, chuva: float) -> float:
    umidade = min(100.0, umidade + chuva * 2.4)
    return 34.0 + (umidade - 34.0) * 0.9965


def aplicar_espraiamento(bruto: float, cota: float) -> float:
    return bruto if bruto <= cota else cota + (bruto - cota) * ESPRAIAMENTO


def desfazer_espraiamento(nivel: float, cota: float) -> float:
    return nivel if nivel <= cota else cota + (nivel - cota) / ESPRAIAMENTO


def perfil_chuva(cenario: str, passos: int, rng: np.random.Generator) -> list[float]:
    """Chuva (mm por 15 min) de um cenário de demonstração."""
    pico = {"tempestade": 16.0, "chuva_moderada": 5.0, "estiagem": 0.0, "normal": 0.0}[cenario]
    duracao = max(1, int(passos * 0.55))
    return [round(max(0.0, pico * math.sin(math.pi * (i + 0.5) / duracao) + rng.normal(0, 0.6)), 1)
            if i < duracao and pico > 0 else 0.0 for i in range(passos)]


def continuar_serie(est: dict, chuvas_passadas: list[float], nivel_atual: float, umidade_atual: float,
                    ultimo_ts: datetime, chuva_nova: list[float], rng: np.random.Generator,
                    origem: str = "demo") -> list[dict]:
    """Gera as próximas leituras de uma estação a partir do estado atual."""
    cota, base = est["cota_transbordo_cm"], est["nivel_base_cm"]
    chuva_total = list(chuvas_passadas) + list(chuva_nova)
    n0 = len(chuvas_passadas)
    armazenamento = desfazer_espraiamento(nivel_atual, cota) - base
    u = umidade_atual
    escoamento = np.zeros(len(chuva_total) + len(KERNEL))
    for t, c in enumerate(chuva_total):
        escoamento[t: t + len(KERNEL)] += c * est["sensibilidade"] * fator_solo(u) * KERNEL
        if t >= n0:
            u = atualizar_umidade(u, c)

    saida, ts, u = [], ultimo_ts, umidade_atual
    for i, c in enumerate(chuva_nova):
        armazenamento = armazenamento * RECESSAO + escoamento[n0 + i] * GANHO_CM
        u = atualizar_umidade(u, c)
        nivel = aplicar_espraiamento(base + armazenamento, cota)
        ts = ts + timedelta(minutes=config.INTERVALO_MIN)
        saida.append({"estacao_id": est["estacao_id"], "ts": ts,
                      "nivel_cm": round(max(0.0, nivel + rng.normal(0, 1.0)), 1),
                      "chuva_mm": c, "umidade_solo_pct": round(min(100.0, u), 1), "origem": origem})
    return saida
