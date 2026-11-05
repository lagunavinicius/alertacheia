"""Simulador das 5 estações (sensores mock).

Cada estação publica uma leitura por ciclo na API, com a mesma física do
histórico. Sem argumentos, o tempo segue estável (sem chuva); com
--tempestade, a estação indicada recebe um temporal.

    python -m iot.simulador                         5 estações, tempo estável
    python -m iot.simulador --tempestade EST-03     temporal no Aricanduva
    python -m iot.simulador --ciclos 20 --intervalo 1

Cada ciclo representa 15 minutos. Com --intervalo 2, uma hora passa em 8 s.
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime

import numpy as np

from alertacheia import config, hidrologia
from iot.cliente_api import API_PADRAO, enviar_leitura, obter


def estado_atual(api: str, estacao_id: str) -> dict:
    detalhe = obter(api, f"/api/estacoes/{estacao_id}?horas=4")
    serie = detalhe["serie"]
    return {"chuvas": [s["chuva_mm"] for s in serie], "nivel": serie[-1]["nivel_cm"],
            "umidade": serie[-1]["umidade_solo_pct"], "ts": datetime.fromisoformat(serie[-1]["ts"])}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=API_PADRAO)
    parser.add_argument("--ciclos", type=int, default=16, help="leituras por estação (16 = 4 h)")
    parser.add_argument("--intervalo", type=float, default=2.0, help="segundos entre ciclos")
    parser.add_argument("--tempestade", metavar="EST-XX", help="estação que recebe o temporal")
    args = parser.parse_args()

    rng = np.random.default_rng()
    planos = {}
    for est in config.ESTACOES:
        e = estado_atual(args.api, est["estacao_id"])
        cenario = "tempestade" if est["estacao_id"] == args.tempestade else "normal"
        chuva = hidrologia.perfil_chuva(cenario, args.ciclos, rng)
        planos[est["estacao_id"]] = hidrologia.continuar_serie(
            est, e["chuvas"], e["nivel"], e["umidade"], e["ts"], chuva, rng, origem="simulador")

    for ciclo in range(args.ciclos):
        print(f"\n--- ciclo {ciclo + 1}/{args.ciclos} ---")
        for est_id, plano in planos.items():
            leitura = plano[ciclo]
            r = enviar_leitura(args.api, leitura)
            marca = " <<" if r.get("eventos") else ""
            print(f"{est_id} {leitura['ts']:%d/%m %H:%M} nível {leitura['nivel_cm']:>6.1f} cm "
                  f"chuva {leitura['chuva_mm']:>4.1f} mm -> {r.get('risco', r)} "
                  f"(p={r.get('prob_transbordo')}) {' '.join(r.get('eventos', []))}{marca}")
        time.sleep(args.intervalo)


if __name__ == "__main__":
    main()
