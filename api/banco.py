"""Banco operacional (SQLite) da API.

O Data Lake guarda o histórico para análise. Este banco guarda o estado
"agora": últimas leituras por estação, alertas emitidos, moradores
cadastrados e a trilha de auditoria. SQLite já vem com o Python e aguenta
com folga a carga de 5 estações.
"""

from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

ESQUEMA = """
CREATE TABLE IF NOT EXISTS leituras (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    estacao_id       TEXT NOT NULL,
    ts               TEXT NOT NULL,
    nivel_cm         REAL NOT NULL,
    chuva_mm         REAL NOT NULL,
    umidade_solo_pct REAL NOT NULL,
    origem           TEXT NOT NULL,
    prob_transbordo  REAL,
    risco            TEXT,
    recebido_em      TEXT NOT NULL,
    UNIQUE (estacao_id, ts)
);
CREATE INDEX IF NOT EXISTS ix_leituras_estacao_ts ON leituras (estacao_id, ts);

CREATE TABLE IF NOT EXISTS estado_estacao (
    estacao_id       TEXT PRIMARY KEY,
    prealerta_ativo  INTEGER NOT NULL DEFAULT 0,
    alerta_ativo     INTEGER NOT NULL DEFAULT 0,
    leituras_abaixo  INTEGER NOT NULL DEFAULT 0,
    risco_alerta     TEXT
);

CREATE TABLE IF NOT EXISTS alertas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    estacao_id       TEXT NOT NULL,
    publico          TEXT NOT NULL,          -- populacao | defesa_civil
    risco            TEXT NOT NULL,
    prob_transbordo  REAL NOT NULL,
    nivel_cm         REAL NOT NULL,
    ts_leitura       TEXT NOT NULL,
    criado_em        TEXT NOT NULL,
    titulo           TEXT NOT NULL,
    sms              TEXT NOT NULL,
    mensagem         TEXT NOT NULL,
    acoes            TEXT NOT NULL,          -- JSON
    texto_audio      TEXT NOT NULL,
    motivos          TEXT NOT NULL,          -- JSON
    gerado_por       TEXT NOT NULL,
    destinatarios    INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'ativo',   -- ativo | encerrado
    atendido_por     TEXT,
    atendido_em      TEXT,
    encerrado_em     TEXT
);
CREATE INDEX IF NOT EXISTS ix_alertas_estacao ON alertas (estacao_id, criado_em);

CREATE TABLE IF NOT EXISTS moradores (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                 TEXT NOT NULL,
    telefone_cifrado     TEXT NOT NULL,      -- Fernet (AES-128 + HMAC)
    telefone_hash        TEXT NOT NULL UNIQUE,  -- HMAC-SHA256, para achar sem decifrar
    telefone_final       TEXT NOT NULL,      -- 4 últimos dígitos, para exibir mascarado
    estacao_id           TEXT NOT NULL,
    mobilidade_reduzida  INTEGER NOT NULL DEFAULT 0,
    canal                TEXT NOT NULL,
    consentimento_em     TEXT NOT NULL,
    criado_em            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ts       TEXT NOT NULL,
    ator     TEXT NOT NULL,
    acao     TEXT NOT NULL,
    detalhe  TEXT
);
"""


class Banco:
    def __init__(self, caminho: Path | str):
        self.caminho = str(caminho)
        if self.caminho != ":memory:":
            Path(self.caminho).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._con = sqlite3.connect(self.caminho, check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        self._con.execute("PRAGMA journal_mode=WAL")
        self._con.executescript(ESQUEMA)

    @contextmanager
    def transacao(self):
        with self._lock:
            try:
                yield self._con
                self._con.commit()
            except Exception:
                self._con.rollback()
                raise

    def consultar(self, sql: str, params: tuple | dict = ()) -> list[dict]:
        with self._lock:
            return [dict(r) for r in self._con.execute(sql, params).fetchall()]

    def um(self, sql: str, params: tuple | dict = ()) -> dict | None:
        linhas = self.consultar(sql, params)
        return linhas[0] if linhas else None

    def fechar(self) -> None:
        self._con.close()
