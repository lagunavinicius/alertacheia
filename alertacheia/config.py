"""Configuração central do AlertaCheia.

Todos os módulos (pipeline, IA, API, simulador IoT) leem daqui os caminhos,
os limiares de risco e o catálogo de estações. A decisão do sensor na borda
(Arduino), a do modelo e a do painel usam as mesmas cotas.
"""

from __future__ import annotations

import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _carregar_env() -> None:
    """Lê um `.env` simples (CHAVE=valor) sem dependência extra."""
    arquivo = RAIZ / ".env"
    if not arquivo.exists():
        return
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip())


_carregar_env()

# --- Caminhos do Data Lake -------------------------------------------------
DATALAKE = Path(os.environ.get("ALERTACHEIA_DATALAKE", RAIZ / "datalake"))
BRONZE = DATALAKE / "bronze"      # dado bruto, exatamente como chegou
SILVER = DATALAKE / "silver"      # dado limpo, validado, sem duplicatas
GOLD = DATALAKE / "gold"          # tabelas analíticas (Power BI, modelo, painel)
QUARENTENA = DATALAKE / "quarentena"
MODELOS = Path(os.environ.get("ALERTACHEIA_MODELOS", RAIZ / "ia" / "artefatos"))
BANCO = Path(os.environ.get("ALERTACHEIA_BANCO", RAIZ / "data" / "alertacheia.db"))

# --- Série histórica simulada ---------------------------------------------
DIAS_HISTORICO = 120
INTERVALO_MIN = 15                     # uma leitura a cada 15 minutos
LEITURAS_POR_HORA = 60 // INTERVALO_MIN
HORIZONTE_PREVISAO_MIN = 120           # o modelo prevê transbordo nas próximas 2 h
SEMENTE = 42

# --- Faixas físicas aceitas (validação de entrada) -------------------------
FAIXA_NIVEL_CM = (0.0, 800.0)
FAIXA_CHUVA_MM = (0.0, 120.0)          # chuva em 15 min
FAIXA_UMIDADE_PCT = (0.0, 100.0)

# --- Faixas de risco (probabilidade do modelo) -----------------------------
# Calibradas pela varredura de limiares em ia/treinar.py (ver metricas.json):
#   ATENCAO    -> pré-alerta só para a Defesa Civil (mais antecedência, mais ruído)
#   ALERTA     -> SMS para os moradores cadastrados (falso alarme ~ régua atual)
#   EMERGENCIA -> não é previsão: o sensor mediu o nível acima da cota de transbordo
NIVEIS_RISCO = [
    # (rótulo, probabilidade mínima)
    ("ALERTA", 0.80),
    ("ATENCAO", 0.60),
    ("NORMAL", 0.0),
]
LIMIAR_PREALERTA = 0.60   # avisa a Defesa Civil
LIMIAR_ALERTA = 0.80      # avisa a população
LIMIAR_DESLIGA = 0.30     # histerese: abaixo disso por 1 h, o alerta encerra

# --- Catálogo de estações --------------------------------------------------
# Locais reais com histórico conhecido de alagamento em São Paulo. As leituras,
# as cotas e a população são SIMULADAS para o protótipo.
ESTACOES = [
    {
        "estacao_id": "EST-01",
        "bairro": "Jardim Pantanal",
        "corpo_dagua": "Rio Tietê",
        "regiao": "Zona Leste",
        "lat": -23.4985, "lon": -46.4329,
        "nivel_base_cm": 90, "cota_alerta_cm": 230, "cota_transbordo_cm": 290,
        "sensibilidade": 1.25, "populacao_risco": 4200,
        "abrigo": "EMEF Jardim Pantanal",
    },
    {
        "estacao_id": "EST-02",
        "bairro": "Jardim Romano",
        "corpo_dagua": "Rio Tietê",
        "regiao": "Zona Leste",
        "lat": -23.4939, "lon": -46.4071,
        "nivel_base_cm": 85, "cota_alerta_cm": 220, "cota_transbordo_cm": 280,
        "sensibilidade": 1.15, "populacao_risco": 3600,
        "abrigo": "CEU Jardim Romano",
    },
    {
        "estacao_id": "EST-03",
        "bairro": "Vila Aricanduva",
        "corpo_dagua": "Córrego Aricanduva",
        "regiao": "Zona Leste",
        "lat": -23.5655, "lon": -46.5146,
        "nivel_base_cm": 60, "cota_alerta_cm": 170, "cota_transbordo_cm": 215,
        "sensibilidade": 1.45, "populacao_risco": 2800,
        "abrigo": "Escola Estadual do Aricanduva",
    },
    {
        "estacao_id": "EST-04",
        "bairro": "Pirajuçara",
        "corpo_dagua": "Córrego Pirajuçara",
        "regiao": "Zona Oeste",
        "lat": -23.5900, "lon": -46.7420,
        "nivel_base_cm": 55, "cota_alerta_cm": 160, "cota_transbordo_cm": 200,
        "sensibilidade": 1.55, "populacao_risco": 3100,
        "abrigo": "CEU Butantã",
    },
    {
        "estacao_id": "EST-05",
        "bairro": "Cabuçu",
        "corpo_dagua": "Córrego Cabuçu de Baixo",
        "regiao": "Zona Norte",
        "lat": -23.4520, "lon": -46.6890,
        "nivel_base_cm": 50, "cota_alerta_cm": 150, "cota_transbordo_cm": 190,
        "sensibilidade": 1.35, "populacao_risco": 2300,
        "abrigo": "CEU Paz",
    },
]
ESTACOES_POR_ID = {e["estacao_id"]: e for e in ESTACOES}

TELEFONE_DEFESA_CIVIL = "199"
TELEFONE_BOMBEIROS = "193"

# --- IA generativa ---------------------------------------------------------
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODELO_IA = os.environ.get("ALERTACHEIA_MODELO_IA", "claude-opus-5-5")

# --- Segurança -------------------------------------------------------------
# Valores padrão servem só para desenvolvimento local e testes; em produção
# o .env (fora do Git) sobrescreve todos.
JWT_SEGREDO = os.environ.get("ALERTACHEIA_JWT_SEGREDO", "dev-somente-local-troque-no-env-0000000000")
JWT_MINUTOS = int(os.environ.get("ALERTACHEIA_JWT_MINUTOS", "60"))
CHAVE_DADOS = os.environ.get("ALERTACHEIA_CHAVE_DADOS", "")  # Fernet; gerada se vazia
OPERADOR_USUARIO = os.environ.get("ALERTACHEIA_OPERADOR", "defesacivil")
OPERADOR_SENHA = os.environ.get("ALERTACHEIA_OPERADOR_SENHA", "alerta@2026")
# Chave de API por estação (o sensor se autentica para publicar leituras).
CHAVE_SENSOR_PADRAO = os.environ.get("ALERTACHEIA_CHAVE_SENSORES", "sensor-dev-chave-local")
ORIGENS_CORS = os.environ.get("ALERTACHEIA_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
HOST = os.environ.get("ALERTACHEIA_HOST", "127.0.0.1")
PORTA = int(os.environ.get("ALERTACHEIA_PORTA", "8080"))


def nivel_de_risco(probabilidade: float, nivel_cm: float | None = None, cota_transbordo: float | None = None) -> str:
    """Converte a probabilidade do modelo em faixa de risco.

    Se o nível medido já passou da cota de transbordo, é EMERGENCIA
    independentemente do modelo: o sensor manda sobre a previsão.
    """
    if nivel_cm is not None and cota_transbordo is not None and nivel_cm >= cota_transbordo:
        return "EMERGENCIA"
    for rotulo, minimo in NIVEIS_RISCO:
        if probabilidade >= minimo:
            return rotulo
    return "NORMAL"
