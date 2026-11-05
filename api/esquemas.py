"""Contratos de entrada da API (validação de entrada).

Tudo que chega de fora passa por aqui antes de tocar no banco ou no modelo:
tipos, faixas físicas, formatos e campos extras proibidos. Uma leitura de
9.999 cm ou um campo inesperado é recusado com 422, antes de ser processado.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from alertacheia import config

ESTACAO_RE = r"^EST-\d{2}$"


def normalizar_telefone(v: str) -> str:
    digitos = re.sub(r"\D", "", v)
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if not re.fullmatch(r"[1-9]{2}9?\d{8}", digitos):
        raise ValueError("telefone inválido: informe DDD + número")
    return digitos


class Leitura(BaseModel):
    model_config = ConfigDict(extra="forbid")

    estacao_id: str = Field(pattern=ESTACAO_RE)
    ts: datetime
    nivel_cm: float = Field(ge=config.FAIXA_NIVEL_CM[0], le=config.FAIXA_NIVEL_CM[1])
    chuva_mm: float = Field(ge=config.FAIXA_CHUVA_MM[0], le=config.FAIXA_CHUVA_MM[1])
    umidade_solo_pct: float = Field(ge=config.FAIXA_UMIDADE_PCT[0], le=config.FAIXA_UMIDADE_PCT[1])
    origem: Literal["sensor", "tinkercad", "simulador", "demo"] = "sensor"

    @field_validator("estacao_id")
    @classmethod
    def estacao_existe(cls, v: str) -> str:
        if v not in config.ESTACOES_POR_ID:
            raise ValueError("estação não cadastrada")
        return v

    @field_validator("ts")
    @classmethod
    def sem_fuso(cls, v: datetime) -> datetime:
        # tudo é gravado em horário local de São Paulo, sem fuso no texto
        return v.replace(tzinfo=None, second=0, microsecond=0)


class CadastroMorador(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=80)
    telefone: str = Field(description="DDD + número, só dígitos ou com máscara")
    estacao_id: str = Field(pattern=ESTACAO_RE)
    mobilidade_reduzida: bool = False
    canal: Literal["sms", "whatsapp"] = "sms"
    consentimento_lgpd: bool

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v: str) -> str:
        if not re.fullmatch(r"[A-Za-zÀ-ÿ' .-]+", v):
            raise ValueError("use apenas letras no nome")
        return v

    @field_validator("telefone")
    @classmethod
    def telefone_br(cls, v: str) -> str:
        return normalizar_telefone(v)

    @field_validator("estacao_id")
    @classmethod
    def estacao_existe(cls, v: str) -> str:
        if v not in config.ESTACOES_POR_ID:
            raise ValueError("bairro não atendido")
        return v

    @field_validator("consentimento_lgpd")
    @classmethod
    def exige_consentimento(cls, v: bool) -> bool:
        if not v:
            raise ValueError("é preciso autorizar o uso do telefone para receber alertas")
        return v


class Descadastro(BaseModel):
    model_config = ConfigDict(extra="forbid")
    telefone: str

    @field_validator("telefone")
    @classmethod
    def telefone_br(cls, v: str) -> str:
        return normalizar_telefone(v)


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    usuario: str = Field(min_length=1, max_length=50)
    senha: str = Field(min_length=1, max_length=128)


class Cenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cenario: Literal["tempestade", "chuva_moderada", "estiagem"] = "tempestade"
    passos: int = Field(default=16, ge=1, le=48)
    intervalo_s: float = Field(default=1.5, ge=0.0, le=10.0)
