"""Gera o PDF de entregáveis (docs/AlertaCheia_entregaveis.pdf).

Junta a documentação de cada área, o diagrama de arquitetura, os prints e as
evidências num HTML e imprime em PDF com o Edge ou o Chrome em modo headless.

    python scripts/gerar_pdf.py

Prints que o grupo tira à mão entram automaticamente se existirem em
docs/evidencias/ com estes prefixos; sem eles, o PDF mostra um aviso "PENDENTE":
    tinkercad_*.png       circuito e Monitor Serial
    powerbi_*.png         páginas do relatório Power BI
    github_actions*.png   pipeline verde no GitHub
"""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
EV = DOCS / "evidencias"
SAIDA_HTML = DOCS / "_entregaveis.html"
SAIDA_PDF = DOCS / "AlertaCheia_entregaveis.pdf"

NAVEGADORES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]


def _recuo_de_lista(texto: str) -> str:
    """O GitHub aceita sublista com 2-3 espaços; o Python-Markdown exige 4."""
    saida, em_codigo = [], False
    for linha in texto.splitlines():
        if linha.lstrip().startswith("```"):
            em_codigo = not em_codigo
        elif not em_codigo:
            m = re.match(r"^( {2,3})(\S.*)$", linha)
            if m:
                linha = "    " + m.group(2)
        saida.append(linha)
    return "\n".join(saida)


def md(arquivo: str) -> str:
    texto = _recuo_de_lista((DOCS / arquivo).read_text(encoding="utf-8"))
    return markdown.markdown(texto, extensions=["tables", "fenced_code", "sane_lists"])


def figura(nome: str, legenda: str, largura: str = "100%") -> str:
    return (f'<figure><img src="evidencias/{nome}" style="width:{largura}">'
            f"<figcaption>{html.escape(legenda)}</figcaption></figure>")


def opcionais(prefixo: str, titulo: str, instrucao: str) -> str:
    achados = sorted(p.name for p in EV.glob(f"{prefixo}*") if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not achados:
        return f'<div class="pendente"><b>PENDENTE: {html.escape(titulo)}.</b> {html.escape(instrucao)}</div>'
    return "".join(figura(n, f"{titulo}: {n}") for n in achados)


def bloco_texto(arquivo: str, titulo: str, max_linhas: int = 80) -> str:
    caminho = EV / arquivo
    if not caminho.exists():
        return ""
    linhas = caminho.read_text(encoding="utf-8-sig", errors="ignore").splitlines()[:max_linhas]
    return f"<h4>{html.escape(titulo)}</h4><pre class='log'>{html.escape(chr(10).join(linhas))}</pre>"


def integrantes() -> str:
    txt = (RAIZ / "GRUPO.txt").read_text(encoding="utf-8")
    return "<pre class='capa-grupo'>" + html.escape(txt) + "</pre>"


def main() -> None:
    metricas = json.loads((RAIZ / "ia" / "artefatos" / "metricas.json").read_text(encoding="utf-8"))
    a = metricas["antecedencia_media_min"]
    svg = (DOCS / "arquitetura.svg").read_text(encoding="utf-8")

    corpo = f"""
<section class="capa">
  <p class="sobre">FIAP · Engenharia de Software · 4ESOA · Global Solution 2026/2 · CitizenTech</p>
  <h1>AlertaCheia</h1>
  <p class="lema">Aviso de enchente para o seu bairro, antes de a água chegar.</p>
  <div class="numeros">
    <div><b>{a['alerta_populacao']:.0f} min</b><span>de aviso antes da água</span></div>
    <div><b>+{a['alerta_populacao'] - a['regra_atual']:.0f} min</b><span>em relação à régua atual</span></div>
    <div><b>0</b><span>enchentes sem aviso (14 no teste)</span></div>
    <div><b>{metricas['teste_modelo']['roc_auc']:.3f}</b><span>ROC AUC do modelo</span></div>
  </div>
  {integrantes()}
</section>

<section class="sumario">
  <h2>Sumário</h2>
  <ol>
    <li>A solução: cidadão, problema, funcionamento, ecossistema, impacto e ODS</li>
    <li>Arquitetura geral</li>
    <li>Área 1: IA e automação</li>
    <li>Área 2: Big Data e visualização</li>
    <li>Área 3: MVP, IoT e experiência digital (telas)</li>
    <li>Área 4: DevOps, segurança e qualidade (evidências)</li>
  </ol>
</section>

<section>{md("01-solucao.md")}</section>

<section><h1>2. Arquitetura geral</h1><div class="svg">{svg}</div>
<p>Detalhamento dos componentes e das conexões entre as áreas: seção 5.4.</p></section>

<section>{md("03-ia.md")}
<h3>Evidência: IA funcionando</h3>
{figura("tela1_meu_bairro_alerta.png", "Alerta redigido pela IA na tela do morador (risco ALERTA, chance de 89%)", "88%")}
{figura("tela3_detalhe_estacao.png", "Chance de transbordo calculada pelo modelo ao longo do temporal e motivos do alerta", "88%")}
{bloco_texto("exemplo_alerta_ia.json", "docs/evidencias/exemplo_alerta_ia.json (gerado por run_pipeline.py)")}
</section>

<section>{md("04-big-data.md")}
<h3>Evidência: dashboards</h3>
{figura("tela7b_painel_historico.png", "Painel da Defesa Civil, aba Histórico: indicadores, chuva × nível em % da cota e 'Onde agir primeiro'")}
{figura("tela7c_painel_modelo.png", "Painel da Defesa Civil, aba Modelo de IA: antecedência do aviso e desempenho no teste")}
{opcionais("powerbi_", "Prints do Power BI", "Monte o relatório com powerbi/README.md, salve os prints em docs/evidencias/powerbi_1.png, powerbi_2.png... e rode de novo scripts/gerar_pdf.py.")}
</section>

<section>{md("05-mvp-iot.md")}
<h3>Evidência: telas do protótipo</h3>
{figura("tela1_meu_bairro_normal.png", "Tela 1 · Meu bairro (normal)", "80%")}
{figura("tela1_meu_bairro_emergencia.png", "Tela 1 · Meu bairro (emergência, com 'Ouvir o alerta')", "80%")}
{figura("tela2_estacoes.png", "Tela 2 · Estações (mapa MapLibre e lista por risco)", "80%")}
{figura("tela4_alertas.png", "Tela 4 · Alertas emitidos", "80%")}
{figura("tela5_cadastro.png", "Tela 5 · Receber alertas (consentimento LGPD)", "70%")}
{figura("tela6_login.png", "Tela 6 · Login da Defesa Civil", "70%")}
{figura("tela7a_painel_ao_vivo.png", "Tela 7 · Painel: mapa ao vivo e fila de alertas da operação", "95%")}
<h3>Evidência: IoT</h3>
{opcionais("tinkercad_", "Prints do TinkerCad", "Monte o circuito com iot/GUIA_TINKERCAD.md, rode a simulação e salve em docs/evidencias/tinkercad_1_circuito.png e tinkercad_2_serial.png.")}
</section>

<section>{md("06-devops-seguranca-testes.md")}
<h3>Evidência: CI/CD no GitHub Actions</h3>
{opcionais("github_actions", "Print do pipeline no GitHub Actions", "Publique a pasta como repositório no GitHub, faça um push na main e salve o print da aba Actions em docs/evidencias/github_actions.png.")}
{bloco_texto("docker_smoke_test.txt", "Docker: container rodando e smoke test (docs/evidencias/docker_smoke_test.txt)")}
{bloco_texto("pytest.txt", "pytest -vv: 32 testes passando e cobertura (docs/evidencias/pytest.txt)", 70)}
{bloco_texto("qualidade_seguranca.txt", "Ruff, Bandit e pip-audit (docs/evidencias/qualidade_seguranca.txt)", 60)}
{figura("api_openapi_docs.png", "Contrato OpenAPI da API (/docs)", "80%")}
</section>
"""
    estilo = """
@page { size: A4; margin: 16mm 15mm 18mm; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1c2633; font-size: 10.2pt; line-height: 1.5; }
h1 { color: #0f1b2d; font-size: 21pt; border-bottom: 3px solid #c2410c; padding-bottom: 4px; margin-top: 0; }
h2 { color: #0f1b2d; font-size: 14pt; margin-top: 18px; }
h3 { color: #0f1b2d; font-size: 12pt; margin-top: 16px; }
h4 { color: #0f1b2d; font-size: 10.5pt; margin: 14px 0 4px; }
section { page-break-before: always; }
section.capa { page-break-before: avoid; padding-top: 40mm; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9pt; page-break-inside: avoid; }
th, td { border: 1px solid #d9d3c7; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f0ece4; }
pre, code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 8.3pt; }
pre { background: #f5f3ee; border: 1px solid #e2ddd3; padding: 8px 10px; white-space: pre-wrap; page-break-inside: avoid; }
pre.log { font-size: 7.6pt; }
blockquote { border-left: 4px solid #c2410c; margin: 8px 0; padding: 4px 12px; background: #fbf7f1; color: #3b4553; }
figure { margin: 12px auto; text-align: center; page-break-inside: avoid; }
figure img { border: 1px solid #d9d3c7; border-radius: 6px; }
figcaption { font-size: 8.5pt; color: #5b6573; margin-top: 4px; }
.svg svg { width: 100%; height: auto; }
.capa h1 { font-size: 44pt; border: 0; margin: 6px 0; }
.capa .sobre { color: #5b6573; text-transform: uppercase; letter-spacing: .08em; font-size: 9pt; }
.capa .lema { font-size: 16pt; color: #3b4553; margin-top: 0; }
.numeros { display: flex; gap: 10px; margin: 26px 0; }
.numeros div { flex: 1; background: #0f1b2d; color: #f5f3ee; border-radius: 10px; padding: 12px; }
.numeros b { display: block; font-size: 20pt; }
.numeros span { font-size: 8.5pt; opacity: .85; }
.capa-grupo { background: #fff; font-size: 10pt; margin-top: 30px; }
.pendente { border: 2px dashed #c2410c; background: #fde8dc; color: #7c2d12; padding: 12px; border-radius: 8px; margin: 10px 0; }
"""
    SAIDA_HTML.write_text(f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><title>AlertaCheia · entregáveis</title>"
                          f"<style>{estilo}</style></head><body>{corpo}</body></html>", encoding="utf-8")

    navegador = next((n for n in NAVEGADORES if Path(n).exists()), None) or shutil.which("msedge") or shutil.which("google-chrome")
    if not navegador:
        sys.exit(f"Edge/Chrome não encontrado. Abra {SAIDA_HTML} no navegador e use Imprimir → Salvar como PDF.")
    subprocess.run([navegador, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",  # noqa: S603
                    f"--print-to-pdf={SAIDA_PDF}", SAIDA_HTML.as_uri()], check=True, capture_output=True, timeout=120)
    pendencias = re.findall(r"PENDENTE: ([^.<]+)", corpo)
    print(f"PDF gerado: {SAIDA_PDF}")
    for p in pendencias:
        print(f"  pendente: {p}")


if __name__ == "__main__":
    main()
