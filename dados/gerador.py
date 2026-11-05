"""Gerador da série histórica simulada (zona bronze).

Simula 120 dias de estação chuvosa (nov/2025 a mar/2026) em 5 estações, com uma leitura
a cada 15 minutos: chuva (pluviômetro), nível do córrego (ultrassônico) e
umidade do solo. O nível responde à chuva com atraso, e o solo encharcado
faz a mesma chuva subir mais o córrego. É assim que uma enchente urbana se
comporta, e é essa relação que o modelo de IA precisa aprender.

O bronze recebe o dado do jeito que um sensor de verdade entrega: com
leituras duplicadas, campos vazios, valores impossíveis (falha do sensor) e
horas sem sinal. Limpar isso é trabalho da camada silver.

Rodar:  python -m dados.gerador
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timedelta

import numpy as np

from alertacheia import config, hidrologia

INICIO = datetime(2025, 11, 15)


def _tempestades(rng: np.random.Generator, n_passos: int) -> np.ndarray:
    """Chuva regional (mm por 15 min) que atinge a cidade inteira."""
    chuva = np.zeros(n_passos)
    passos_dia = 24 * config.LEITURAS_POR_HORA
    for dia in range(config.DIAS_HISTORICO):
        if rng.random() > 0.42:  # ~42% dos dias de verão têm pancada de chuva
            continue
        # pancadas de verão: fim de tarde é o horário mais comum
        hora = int(np.clip(rng.normal(16.5, 2.5), 0, 23))
        inicio = dia * passos_dia + hora * config.LEITURAS_POR_HORA + int(rng.integers(0, 4))
        duracao = int(rng.integers(2, 13))  # 30 min a 3 h
        pico = float(rng.gamma(2.0, 3.2))   # mm em 15 min no pico
        if rng.random() < 0.12:              # alguns temporais fortes
            pico *= rng.uniform(1.8, 2.6)
        forma = np.sin(np.linspace(0.15, np.pi - 0.15, duracao))
        fim = min(inicio + duracao, n_passos)
        chuva[inicio:fim] += pico * forma[: fim - inicio]
    return chuva


def _simular_estacao(est: dict, regional: np.ndarray, rng: np.random.Generator) -> dict[str, np.ndarray]:
    n = len(regional)
    # cada bairro recebe a chuva regional com variação local + chuvas isoladas
    local = regional * rng.uniform(0.6, 1.4, size=n) * (regional > 0)
    isoladas = (rng.random(n) < 0.0025) * rng.gamma(2.0, 4.0, size=n)
    chuva = np.clip(local + isoladas, 0, None).round(1)

    umidade = np.empty(n)
    nivel = np.empty(n)
    u = 38.0
    armazenamento = 0.0
    kernel = hidrologia.KERNEL   # hidrograma unitário: a chuva chega ao córrego ~45-60 min depois
    escoamento = np.zeros(n + len(kernel))
    cota = est["cota_transbordo_cm"]
    for t in range(n):
        u = hidrologia.atualizar_umidade(u, chuva[t])   # o solo encharca e seca devagar
        umidade[t] = u
        efetivo = chuva[t] * est["sensibilidade"] * hidrologia.fator_solo(u)
        escoamento[t: t + len(kernel)] += efetivo * kernel
        armazenamento = armazenamento * hidrologia.RECESSAO + escoamento[t] * hidrologia.GANHO_CM
        nivel[t] = hidrologia.aplicar_espraiamento(est["nivel_base_cm"] + armazenamento, cota)

    nivel = nivel + rng.normal(0, 1.5, size=n)
    umidade = np.clip(umidade + rng.normal(0, 1.0, size=n), 0, 100)
    return {"chuva": chuva, "nivel": nivel.round(1), "umidade": umidade.round(1)}


def _sujar(registros: list[dict], rng: np.random.Generator) -> list[dict]:
    """Insere os defeitos típicos de dado de sensor."""
    saida: list[dict] = []
    offline_ate = -1
    for i, r in enumerate(registros):
        if i <= offline_ate:
            continue  # estação sem sinal: as leituras simplesmente não chegam
        if rng.random() < 0.0008:
            offline_ate = i + int(rng.integers(3, 16))  # 45 min a 4 h sem sinal
            continue
        sorteio = rng.random()
        if sorteio < 0.003:
            r = {**r, "nivel_cm": None}                                 # campo vazio
        elif sorteio < 0.005:
            r = {**r, "nivel_cm": float(rng.choice([-50.0, 9999.0]))}   # leitura impossível
        elif sorteio < 0.006:
            r = {**r, "umidade_solo_pct": 180.0}
        saida.append(r)
        if rng.random() < 0.006:
            saida.append(dict(r))                                        # reenvio duplicado
    return saida


def gerar() -> dict:
    rng = np.random.default_rng(config.SEMENTE)
    n = config.DIAS_HISTORICO * 24 * config.LEITURAS_POR_HORA
    tempos = [INICIO + timedelta(minutes=config.INTERVALO_MIN * i) for i in range(n)]
    regional = _tempestades(rng, n)

    destino = config.BRONZE / "leituras"
    if destino.exists():
        shutil.rmtree(destino)

    total = 0
    for est in config.ESTACOES:
        serie = _simular_estacao(est, regional, rng)
        registros = [
            {
                "estacao_id": est["estacao_id"],
                "ts": tempos[i].isoformat(timespec="minutes"),
                "nivel_cm": float(serie["nivel"][i]),
                "chuva_mm": float(serie["chuva"][i]),
                "umidade_solo_pct": float(serie["umidade"][i]),
                "origem": "historico",
            }
            for i in range(n)
        ]
        registros = _sujar(registros, rng)
        # particionado por dia, como chegaria de um broker de mensagens
        por_dia: dict[str, list[dict]] = {}
        for r in registros:
            por_dia.setdefault(r["ts"][:10], []).append(r)
        for dia, linhas in por_dia.items():
            pasta = destino / f"data={dia}"
            pasta.mkdir(parents=True, exist_ok=True)
            with open(pasta / f"{est['estacao_id']}.jsonl", "w", encoding="utf-8") as f:
                for linha in linhas:
                    f.write(json.dumps(linha, ensure_ascii=False) + "\n")
        total += len(registros)
    return {"registros_bronze": total, "estacoes": len(config.ESTACOES), "dias": config.DIAS_HISTORICO}


if __name__ == "__main__":
    print(gerar())
