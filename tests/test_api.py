"""CT-10 a CT-18 · API: segurança, validação, proteção de dados e fluxo completo."""

from __future__ import annotations

import sqlite3
import time
from datetime import datetime, timedelta

from alertacheia import config
from api.seguranca import chave_da_estacao


def _leitura(estacao_id="EST-01", **extra):
    base = {"estacao_id": estacao_id, "ts": (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M"),
            "nivel_cm": 100.0, "chuva_mm": 0.0, "umidade_solo_pct": 40.0}
    return {**base, **extra}


def test_ct10_sensor_precisa_da_chave_da_propria_estacao(cliente):
    """CT-10: sem chave -> 401; chave de outra estação -> 401; chave certa -> 201."""
    assert cliente.post("/api/leituras", json=_leitura()).status_code == 401
    r = cliente.post("/api/leituras", json=_leitura(), headers={"X-API-Key": chave_da_estacao("EST-02")})
    assert r.status_code == 401
    r = cliente.post("/api/leituras", json=_leitura(), headers={"X-API-Key": chave_da_estacao("EST-01")})
    assert r.status_code == 201, r.text
    assert r.json()["risco"] in {"NORMAL", "ATENCAO", "ALERTA", "EMERGENCIA"}


def test_ct11_validacao_de_entrada_recusa_dado_ruim(cliente):
    """CT-11: leitura impossível, campo extra ou estação inexistente -> 422."""
    h = {"X-API-Key": chave_da_estacao("EST-01")}
    assert cliente.post("/api/leituras", json=_leitura(nivel_cm=9999), headers=h).status_code == 422
    assert cliente.post("/api/leituras", json=_leitura(nivel_cm=-1), headers=h).status_code == 422
    assert cliente.post("/api/leituras", json=_leitura(comando="DROP TABLE"), headers=h).status_code == 422
    r = cliente.post("/api/leituras", json=_leitura("EST-99"), headers={"X-API-Key": chave_da_estacao("EST-99")})
    assert r.status_code == 422
    # tentativa de injeção no filtro: barrada pelo padrão do parâmetro
    assert cliente.get("/api/alertas", params={"estacao_id": "EST-01' OR 1=1 --"}).status_code == 422


def test_ct12_leitura_duplicada_e_idempotente_e_vai_para_o_bronze(cliente):
    """CT-12: o mesmo instante reenviado não duplica; a leitura entra no Data Lake (bronze)."""
    h = {"X-API-Key": chave_da_estacao("EST-04")}
    leitura = _leitura("EST-04")
    assert cliente.post("/api/leituras", json=leitura, headers=h).status_code == 201
    r = cliente.post("/api/leituras", json=leitura, headers=h)
    assert r.status_code == 200 and r.json()["duplicada"] is True
    arquivo = config.BRONZE / "tempo_real" / f"data={leitura['ts'][:10]}" / "EST-04.jsonl"
    assert arquivo.exists() and leitura["ts"] in arquivo.read_text(encoding="utf-8")


def test_ct13_painel_exige_login_valido(cliente, token):
    """CT-13: painel sem token ou com token adulterado -> 401; com token -> 200."""
    assert cliente.get("/api/painel/resumo").status_code == 401
    falso = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.assinatura-falsa"}
    assert cliente.get("/api/painel/resumo", headers=falso).status_code == 401
    r = cliente.get("/api/painel/resumo", headers=token, params={"estacao_id": "EST-03"})
    assert r.status_code == 200
    assert r.json()["indicadores"]["eventos_transbordo"] >= 0


def test_ct14_login_bloqueia_forca_bruta(cliente):
    """CT-14: após 5 senhas erradas o IP é bloqueado (429), mesmo com a senha certa."""
    for _ in range(5):
        assert cliente.post("/api/auth/login", json={"usuario": "operador_teste", "senha": "x"}).status_code == 401
    r = cliente.post("/api/auth/login", json={"usuario": "operador_teste", "senha": "senha-de-teste-123"})
    assert r.status_code == 429


def test_ct15_telefone_protegido_e_direito_de_exclusao(cliente):
    """CT-15 (LGPD): sem consentimento -> 422; telefone cifrado no banco e mascarado
    na resposta; o morador consegue se descadastrar."""
    cadastro = {"nome": "Maria Souza", "telefone": "(11) 98888-7777", "estacao_id": "EST-02",
                "consentimento_lgpd": False}
    assert cliente.post("/api/moradores", json=cadastro).status_code == 422
    r = cliente.post("/api/moradores", json={**cadastro, "consentimento_lgpd": True})
    assert r.status_code == 201 and r.json()["telefone"] == "(**) *****-7777"
    assert cliente.post("/api/moradores", json={**cadastro, "consentimento_lgpd": True}).status_code == 409

    con = sqlite3.connect(config.BANCO)
    gravado = con.execute("SELECT telefone_cifrado FROM moradores").fetchone()[0]
    con.close()
    assert "988887777" not in gravado and "11988887777" not in gravado

    r = cliente.request("DELETE", "/api/moradores", json={"telefone": "11988887777"})
    assert r.json()["removido"] is True


def test_ct16_fluxo_completo_da_chuva_ao_sms(cliente, token):
    """CT-16 (fluxo ponta a ponta): morador se cadastra -> temporal na estação ->
    pré-alerta para a Defesa Civil -> alerta com SMS ao morador -> painel mostra e
    o operador marca o alerta como atendido."""
    cliente.post("/api/moradores", json={"nome": "João Lima", "telefone": "11977776666", "estacao_id": "EST-03",
                                         "mobilidade_reduzida": True, "consentimento_lgpd": True})
    r = cliente.post("/api/painel/simular/EST-03", headers=token,
                     json={"cenario": "tempestade", "passos": 16, "intervalo_s": 0})
    assert r.status_code == 202
    for _ in range(50):
        alertas = cliente.get("/api/painel/alertas", headers=token).json()
        if any(a["publico"] == "populacao" for a in alertas):
            break
        time.sleep(0.1)
    publicos = {a["publico"] for a in alertas}
    assert {"defesa_civil", "populacao"} <= publicos
    alerta = next(a for a in alertas if a["publico"] == "populacao")
    assert alerta["destinatarios"] == 1
    assert any("dificuldade para andar" in acao for acao in alerta["acoes"])
    assert cliente.get("/api/alertas", params={"estacao_id": "EST-03"}).json()  # visível ao cidadão
    assert cliente.post(f"/api/painel/alertas/{alerta['id']}/atender", headers=token).status_code == 200
    log_sms = (config.BANCO.parent / "sms_enviados.log").read_text(encoding="utf-8")
    assert "*****-6666" in log_sms and "977776666" not in log_sms


def test_ct17_monitoramento(cliente):
    """CT-17: saúde e métricas expostas para monitoramento."""
    saude = cliente.get("/api/saude").json()
    assert saude["status"] == "ok" and saude["modelo_carregado"] is True
    texto = cliente.get("/api/metricas").text
    assert "alertacheia_requisicoes_total" in texto and "alertacheia_risco_estacao" in texto


def test_ct18_cabecalhos_de_seguranca(cliente):
    """CT-18: respostas saem com cabeçalhos de proteção do navegador."""
    r = cliente.get("/api/estacoes")
    assert r.status_code == 200 and len(r.json()) == len(config.ESTACOES)
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in r.headers["Content-Security-Policy"]


def test_audio_do_alerta(cliente):
    """CT-19: o alerta tem voz neural; sem o modelo instalado, 503 (o navegador usa a voz do sistema)."""
    from ia import voz

    assert cliente.get("/api/alertas/999999/audio").status_code == 404
    assert voz.preparar_texto("EMERGÊNCIA: enchente em Vila Aricanduva") == "Emergência: enchente em Vila Aricanduva"
    alertas = cliente.get("/api/alertas").json()
    if not alertas:
        return
    r = cliente.get(f"/api/alertas/{alertas[0]['id']}/audio")
    if voz.disponivel():
        assert r.status_code == 200 and r.headers["content-type"] == "audio/wav" and r.content[:4] == b"RIFF"
    else:
        assert r.status_code == 503


def test_banco_fechado_nao_derruba_o_processo(tmp_path):
    """CT-20: uma simulação que ainda grava quando a API desliga recebe um erro tratável, não um segfault."""
    import pytest

    from api.banco import Banco, BancoFechado

    b = Banco(tmp_path / "t.db")
    b.fechar()
    with pytest.raises(BancoFechado):
        b.consultar("SELECT 1")
    with pytest.raises(BancoFechado), b.transacao() as con:
        con.execute("SELECT 1")
