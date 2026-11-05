"""Reconstrói tudo do zero: histórico -> Data Lake -> modelo -> exemplos de IA.

    python run_pipeline.py                 gera o histórico e roda tudo
    python run_pipeline.py --sem-gerar     reaproveita o bronze (inclui o que chegou ao vivo)

Etapas:
  1. dados.gerador       série histórica simulada (bronze)
  2. dados.pipeline      bronze -> silver -> gold (+ quarentena)
  3. ia.treinar          modelo de risco, métricas, previsões e eventos (gold)
  4. ia.alerta_generativo exemplo de entrada e saída do agente (docs/evidencias)
"""

from __future__ import annotations

import argparse
import json
import time

from alertacheia import config
from dados import gerador, pipeline
from ia import alerta_generativo, treinar


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sem-gerar", action="store_true", help="não recria o histórico simulado")
    args = parser.parse_args()

    inicio = time.perf_counter()
    if not args.sem_gerar:
        print("[1/4] gerando histórico simulado...", gerador.gerar())
    print("[2/4] processando o Data Lake...")
    resumo = pipeline.executar()
    print(f"      bronze {resumo['bronze_recebidas']} · quarentena {resumo['quarentena']} · "
          f"duplicadas {resumo['duplicadas_removidas']} · silver {resumo['silver_linhas']} · "
          f"eventos {resumo['eventos_transbordo']}")
    print("[3/4] treinando e avaliando o modelo de risco...")
    m = treinar.treinar()
    a = m["antecedencia_media_min"]
    print(f"      ROC AUC {m['teste_modelo']['roc_auc']} · antecedência média: modelo {a['alerta_populacao']} min "
          f"x régua {a['regra_atual']} min ({m['eventos_teste']} enchentes no teste)")
    print("[4/4] gerando exemplo do alerta da IA generativa...")
    ctx = alerta_generativo._exemplo()
    saida = alerta_generativo.gerar_alerta(ctx)
    destino = config.RAIZ / "docs" / "evidencias"
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "exemplo_alerta_ia.json").write_text(
        json.dumps({"entrada": ctx, "saida": saida}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      gerado por: {saida['gerado_por']} -> docs/evidencias/exemplo_alerta_ia.json")
    print(f"pronto em {time.perf_counter() - inicio:.1f}s")


if __name__ == "__main__":
    main()
