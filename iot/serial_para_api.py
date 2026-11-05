"""Ponte TinkerCad -> API.

O TinkerCad roda no navegador e não tem rede. A estação imprime cada leitura
como CSV no Monitor Serial. Este script lê esse CSV (copiado para um .txt ou
lido direto de uma porta serial, se houver Arduino físico) e envia cada
linha para a API como se fosse a estação conectada.

    python -m iot.serial_para_api iot/exemplo_serial_tinkercad.txt
    python -m iot.serial_para_api COM3 --serial          (Arduino real, requer pyserial)

O Arduino não tem relógio: "seq" vira horário a partir da última leitura que
a API tem da estação, de 15 em 15 minutos.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta

from alertacheia import config
from iot.cliente_api import API_PADRAO, enviar_leitura, obter


def interpretar(linha: str) -> dict | None:
    partes = linha.strip().split(",")
    if len(partes) != 6 or not partes[0].startswith("EST-"):
        return None  # cabeçalho, linha vazia ou ruído do monitor serial
    estacao, seq, nivel, chuva, solo, status_local = partes
    try:
        return {"estacao_id": estacao, "seq": int(seq), "nivel_cm": float(nivel), "chuva_mm": float(chuva),
                "umidade_solo_pct": float(solo), "status_local": status_local}
    except ValueError:
        return None


def linhas_de(origem: str, serial: bool):
    if serial:
        import serial as pyserial  # opcional: só para Arduino físico

        with pyserial.Serial(origem, 9600, timeout=5) as porta:
            while True:
                yield porta.readline().decode("ascii", errors="ignore")
    else:
        with open(origem, encoding="ascii", errors="ignore") as f:
            yield from f


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("origem", help="arquivo .txt com o Monitor Serial, ou porta (COM3, /dev/ttyUSB0)")
    parser.add_argument("--serial", action="store_true", help="ler de uma porta serial real")
    parser.add_argument("--api", default=API_PADRAO)
    parser.add_argument("--intervalo", type=float, default=0.5, help="segundos entre envios")
    args = parser.parse_args()

    base_ts: dict[str, datetime] = {}
    enviados = recusados = 0
    for texto in linhas_de(args.origem, args.serial):
        leitura = interpretar(texto)
        if leitura is None:
            continue
        est = leitura["estacao_id"]
        if est not in base_ts:
            if est not in config.ESTACOES_POR_ID:
                print(f"estação desconhecida: {est}", file=sys.stderr)
                continue
            ultima = obter(args.api, f"/api/estacoes/{est}?horas=1")["ultima_leitura"]
            base_ts[est] = datetime.fromisoformat(ultima["ts"]) if ultima else datetime.now()
        ts = base_ts[est] + timedelta(minutes=config.INTERVALO_MIN * (leitura["seq"] + 1))
        resposta = enviar_leitura(args.api, {
            "estacao_id": est, "ts": ts, "nivel_cm": leitura["nivel_cm"], "chuva_mm": leitura["chuva_mm"],
            "umidade_solo_pct": leitura["umidade_solo_pct"], "origem": "tinkercad"})
        if "erro" in resposta:
            recusados += 1
            print(f"[recusada {resposta['erro']}] seq={leitura['seq']} {resposta['detalhe']}")
        else:
            enviados += 1
            print(f"seq={leitura['seq']:>3} {ts:%H:%M} nível={leitura['nivel_cm']:>6.1f} cm  "
                  f"borda={leitura['status_local']:<10} nuvem={resposta.get('risco')} "
                  f"p={resposta.get('prob_transbordo')} {' '.join(resposta.get('eventos', []))}")
        time.sleep(args.intervalo)
    print(f"\nenviadas: {enviados} · recusadas pela validação: {recusados}")


if __name__ == "__main__":
    main()
