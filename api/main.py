"""API do AlertaCheia (FastAPI).

Rotas públicas (cidadão)        GET  /api/estacoes, /api/estacoes/{id}, /api/alertas
                                POST /api/moradores, DELETE /api/moradores
Rota do sensor (chave por estação)  POST /api/leituras
Rotas da Defesa Civil (JWT)     POST /api/auth/login
                                GET  /api/painel/resumo, /api/painel/alertas
                                POST /api/painel/alertas/{id}/atender, /api/painel/simular/{id}
Monitoramento                   GET  /api/saude, /api/metricas (formato Prometheus)

Rodar:  python -m api.main          (http://127.0.0.1:8000 · contrato em /docs)
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from alertacheia import config
from api import esquemas, seguranca, servico
from api.banco import Banco
from ia import modelo

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","nivel":"%(levelname)s",'
                                               '"origem":"%(name)s","msg":"%(message)s"}')
log = logging.getLogger("alertacheia.api")

FRONTEND = config.RAIZ / "frontend" / "dist"
INICIO_PROCESSO = time.time()
METRICAS: Counter = Counter()
LATENCIA_MS: Counter = Counter()


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    app.state.banco = Banco(config.BANCO)
    app.state.gold = servico.Gold()
    app.state.simulacoes = {}
    try:
        modelo.carregar()
        semeadas = servico.semear_estado_inicial(app.state.banco)
        if semeadas:
            log.info("estado inicial semeado com %s leituras", semeadas)
    except modelo.ModeloAusente as erro:
        log.warning(str(erro))
    yield
    for tarefa in app.state.simulacoes.values():
        tarefa.cancel()
    app.state.banco.fechar()


app = FastAPI(title="AlertaCheia API", version="1.0.0", lifespan=ciclo_de_vida,
              description="Alerta comunitário de enchentes · Global Solution 2026/2 · FIAP")
app.add_middleware(CORSMiddleware, allow_origins=config.ORIGENS_CORS, allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["Authorization", "Content-Type", "X-API-Key"])


@app.middleware("http")
async def cabecalhos_e_metricas(request: Request, chamar):
    inicio = time.perf_counter()
    try:
        resposta = await chamar(request)
    except Exception:  # nunca devolve stack trace ao cliente
        log.exception("erro não tratado em %s", request.url.path)
        resposta = JSONResponse({"detail": "erro interno"}, status_code=500)
    duracao = (time.perf_counter() - inicio) * 1000
    rota = request.scope.get("route")
    caminho = getattr(rota, "path", "outro")
    METRICAS[(request.method, caminho, resposta.status_code)] += 1
    LATENCIA_MS[caminho] += duracao
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    resposta.headers["X-Frame-Options"] = "DENY"
    resposta.headers["Referrer-Policy"] = "no-referrer"
    resposta.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data:; connect-src 'self'")
    return resposta


def banco(request: Request) -> Banco:
    return request.app.state.banco


def exigir_modelo() -> None:
    try:
        modelo.carregar()
    except modelo.ModeloAusente as erro:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(erro)) from None


# --------------------------------------------------------------------------
# Monitoramento
# --------------------------------------------------------------------------
@app.get("/api/saude", tags=["monitoramento"])
def saude(request: Request):
    try:
        modelo.carregar()
        modelo_ok = True
    except modelo.ModeloAusente:
        modelo_ok = False
    ultima = banco(request).um("SELECT MAX(recebido_em) AS r FROM leituras")
    return {"status": "ok" if modelo_ok else "degradado", "modelo_carregado": modelo_ok,
            "gold_disponivel": request.app.state.gold.disponivel,
            "ultima_leitura_recebida": ultima["r"] if ultima else None,
            "uptime_s": round(time.time() - INICIO_PROCESSO)}


@app.get("/api/metricas", response_class=PlainTextResponse, tags=["monitoramento"])
def metricas(request: Request):
    linhas = ["# HELP alertacheia_requisicoes_total Requisições por rota e status",
              "# TYPE alertacheia_requisicoes_total counter"]
    for (metodo, rota, cod), n in sorted(METRICAS.items()):
        linhas.append(f'alertacheia_requisicoes_total{{metodo="{metodo}",rota="{rota}",status="{cod}"}} {n}')
    linhas += ["# HELP alertacheia_risco_estacao Risco atual por estação (0 normal a 3 emergência)",
               "# TYPE alertacheia_risco_estacao gauge"]
    for e in servico.estado_estacoes(banco(request)):
        risco = (e["ultima_leitura"] or {}).get("risco") or "NORMAL"
        linhas.append(f'alertacheia_risco_estacao{{estacao="{e["estacao_id"]}"}} {servico.ORDEM_RISCO[risco]}')
    alertas = banco(request).um("SELECT COUNT(*) AS n FROM alertas")
    linhas += ["# TYPE alertacheia_alertas_emitidos_total counter",
               f"alertacheia_alertas_emitidos_total {alertas['n']}",
               "# TYPE alertacheia_uptime_segundos gauge",
               f"alertacheia_uptime_segundos {round(time.time() - INICIO_PROCESSO)}"]
    return "\n".join(linhas) + "\n"


# --------------------------------------------------------------------------
# Sensor
# --------------------------------------------------------------------------
@app.post("/api/leituras", status_code=201, tags=["sensor"])
def receber_leitura(leitura: esquemas.Leitura, request: Request,
                    x_api_key: str | None = Header(default=None), _m=Depends(exigir_modelo)):
    seguranca.verificar_chave_sensor(leitura.estacao_id, x_api_key)
    resultado = servico.registrar_leitura(banco(request), leitura.model_dump())
    if resultado["duplicada"]:
        return JSONResponse(resultado, status_code=200)
    return resultado


# --------------------------------------------------------------------------
# Cidadão
# --------------------------------------------------------------------------
@app.get("/api/estacoes", tags=["cidadao"])
def listar_estacoes(request: Request):
    return servico.estado_estacoes(banco(request))


@app.get("/api/estacoes/{estacao_id}", tags=["cidadao"])
def detalhar_estacao(estacao_id: str, request: Request, horas: int = Query(24, ge=1, le=48)):
    if estacao_id not in config.ESTACOES_POR_ID:
        raise HTTPException(404, "estação não encontrada")
    estado = next(e for e in servico.estado_estacoes(banco(request)) if e["estacao_id"] == estacao_id)
    return {**estado, "serie": servico.serie(banco(request), estacao_id, horas)}


@app.get("/api/alertas", tags=["cidadao"])
def alertas_publicos(request: Request, estacao_id: str | None = Query(None, pattern=esquemas.ESTACAO_RE),
                     limite: int = Query(20, ge=1, le=100)):
    return servico.listar_alertas(banco(request), estacao_id, "populacao", limite)


@app.post("/api/moradores", status_code=201, tags=["cidadao"])
def cadastrar_morador(dados: esquemas.CadastroMorador, request: Request):
    tel_hash = seguranca.hash_telefone(dados.telefone)
    try:
        with banco(request).transacao() as con:
            con.execute(
                "INSERT INTO moradores (nome, telefone_cifrado, telefone_hash, telefone_final, estacao_id, "
                "mobilidade_reduzida, canal, consentimento_em, criado_em) VALUES (?,?,?,?,?,?,?,?,?)",
                (dados.nome, seguranca.cifrar(dados.telefone), tel_hash, dados.telefone[-4:], dados.estacao_id,
                 int(dados.mobilidade_reduzida), dados.canal, servico.agora().isoformat(),
                 servico.agora().isoformat()))
    except Exception as erro:
        if "UNIQUE" in str(erro):
            raise HTTPException(409, "este telefone já está cadastrado") from None
        raise
    servico.auditar(banco(request), "cidadao", "cadastro_morador", dados.estacao_id)
    return {"nome": dados.nome, "telefone": seguranca.mascarar_telefone(dados.telefone[-4:]),
            "bairro": config.ESTACOES_POR_ID[dados.estacao_id]["bairro"], "canal": dados.canal,
            "mensagem": "Cadastro feito. Você vai receber os alertas do seu bairro."}


@app.delete("/api/moradores", tags=["cidadao"])
def descadastrar_morador(dados: esquemas.Descadastro, request: Request):
    """Direito de exclusão (LGPD art. 18): apaga o cadastro pelo telefone."""
    with banco(request).transacao() as con:
        cur = con.execute("DELETE FROM moradores WHERE telefone_hash = ?", (seguranca.hash_telefone(dados.telefone),))
    servico.auditar(banco(request), "cidadao", "exclusao_morador", f"removidos={cur.rowcount}")
    return {"removido": cur.rowcount > 0}


@app.get("/api/ia/metricas", tags=["cidadao"])
def metricas_modelo(request: Request):
    request.app.state.gold.carregar()
    return getattr(request.app.state.gold, "metricas", {})


# --------------------------------------------------------------------------
# Defesa Civil
# --------------------------------------------------------------------------
@app.post("/api/auth/login", tags=["defesa civil"])
def login(dados: esquemas.Login, request: Request):
    ip = seguranca.ip_do_cliente(request)
    seguranca.limitador_login.checar(ip)
    if not seguranca.autenticar_operador(dados.usuario, dados.senha):
        seguranca.limitador_login.falhou(ip)
        servico.auditar(banco(request), dados.usuario[:50], "login_falhou", ip)
        raise HTTPException(401, "usuário ou senha inválidos")
    seguranca.limitador_login.limpar(ip)
    servico.auditar(banco(request), dados.usuario, "login_ok", ip)
    return {"token": seguranca.emitir_token(dados.usuario), "tipo": "Bearer", "expira_min": config.JWT_MINUTOS}


@app.get("/api/painel/resumo", tags=["defesa civil"])
def painel_resumo(request: Request, operador: str = Depends(seguranca.operador_atual),
                  estacao_id: str | None = Query(None, pattern=esquemas.ESTACAO_RE),
                  inicio: date | None = None, fim: date | None = None):
    gold = request.app.state.gold
    gold.carregar()
    if not gold.disponivel:
        raise HTTPException(503, "camada gold ausente; rode `python run_pipeline.py`")
    return servico.painel_resumo(gold, banco(request), estacao_id, inicio, fim)


@app.get("/api/painel/alertas", tags=["defesa civil"])
def painel_alertas(request: Request, operador: str = Depends(seguranca.operador_atual),
                   estacao_id: str | None = Query(None, pattern=esquemas.ESTACAO_RE),
                   limite: int = Query(50, ge=1, le=200)):
    return servico.listar_alertas(banco(request), estacao_id, None, limite)


@app.post("/api/painel/alertas/{alerta_id}/atender", tags=["defesa civil"])
def atender_alerta(alerta_id: int, request: Request, operador: str = Depends(seguranca.operador_atual)):
    with banco(request).transacao() as con:
        cur = con.execute("UPDATE alertas SET atendido_por = ?, atendido_em = ? WHERE id = ? AND atendido_em IS NULL",
                          (operador, servico.agora().isoformat(), alerta_id))
    if cur.rowcount == 0:
        raise HTTPException(404, "alerta não encontrado ou já atendido")
    servico.auditar(banco(request), operador, "alerta_atendido", str(alerta_id))
    return {"id": alerta_id, "atendido_por": operador}


@app.post("/api/painel/simular/{estacao_id}", status_code=202, tags=["defesa civil"])
async def simular(estacao_id: str, cenario: esquemas.Cenario, request: Request,
                  operador: str = Depends(seguranca.operador_atual), _m=Depends(exigir_modelo)):
    """Dispara um cenário de chuva na estação (demonstração e treinamento da
    equipe). As leituras passam pelo mesmo caminho de um sensor real."""
    if estacao_id not in config.ESTACOES_POR_ID:
        raise HTTPException(404, "estação não encontrada")
    em_curso = request.app.state.simulacoes.get(estacao_id)
    if em_curso and not em_curso.done():
        raise HTTPException(409, "já existe uma simulação em andamento nesta estação")
    b = banco(request)
    leituras = servico.leituras_de_cenario(b, estacao_id, cenario.cenario, cenario.passos)

    async def executar():
        for leitura in leituras:
            await asyncio.to_thread(servico.registrar_leitura, b, leitura)
            await asyncio.sleep(cenario.intervalo_s)

    request.app.state.simulacoes[estacao_id] = asyncio.create_task(executar())
    servico.auditar(b, operador, "simulacao", f"{estacao_id}:{cenario.cenario}")
    return {"estacao_id": estacao_id, "cenario": cenario.cenario, "leituras": len(leituras),
            "duracao_s": round(len(leituras) * cenario.intervalo_s, 1)}


@app.get("/api/painel/auditoria", tags=["defesa civil"])
def auditoria(request: Request, operador: str = Depends(seguranca.operador_atual)):
    return banco(request).consultar("SELECT * FROM auditoria ORDER BY id DESC LIMIT 100")


# --------------------------------------------------------------------------
# Frontend (build do React servido pela própria API)
# --------------------------------------------------------------------------
if (FRONTEND / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")


@app.get("/{caminho:path}", include_in_schema=False)
def spa(caminho: str):
    if caminho.startswith("api/"):
        raise HTTPException(404, "rota não encontrada")
    arquivo = (FRONTEND / caminho).resolve()
    if caminho and arquivo.is_file() and FRONTEND.resolve() in arquivo.parents:
        return FileResponse(arquivo)
    indice = FRONTEND / "index.html"
    if indice.exists():
        # o HTML sempre revalida (aponta para os assets com hash do build mais novo);
        # sem isso, o navegador mostra a versão antiga depois de um deploy
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})
    return JSONResponse({"mensagem": "API no ar. Frontend não compilado: rode `npm run build` em frontend/.",
                         "documentacao": "/docs"})


def _rodar() -> None:
    import uvicorn

    uvicorn.run("api.main:app", host=config.HOST, port=config.PORTA, log_level="info")


if __name__ == "__main__":
    _rodar()
