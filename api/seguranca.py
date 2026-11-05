"""Práticas de segurança da API.

1. Autenticação do sensor: cada estação tem uma chave própria, derivada de
   um segredo mestre (HMAC). A chave de uma estação não publica leitura de
   outra, então uma chave vazada não falsifica o bairro vizinho.
2. Autenticação do operador da Defesa Civil: senha com PBKDF2-SHA256 e token
   JWT de validade curta.
3. Limite de tentativas de login por IP, contra força bruta.
4. Proteção de dados pessoais (LGPD): o telefone do morador é guardado
   cifrado (Fernet), localizado por HMAC e sempre exibido mascarado.
5. Comparações em tempo constante (hmac.compare_digest) em todas as checagens
   de segredo.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from alertacheia import config

log = logging.getLogger("alertacheia.seguranca")

# --------------------------------------------------------------------------
# 1. Chave por estação
# --------------------------------------------------------------------------


def chave_da_estacao(estacao_id: str) -> str:
    return hmac.new(config.CHAVE_SENSOR_PADRAO.encode(), estacao_id.encode(), hashlib.sha256).hexdigest()[:32]


def verificar_chave_sensor(estacao_id: str, chave: str | None) -> None:
    if not chave or not hmac.compare_digest(chave, chave_da_estacao(estacao_id)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "chave do sensor inválida para esta estação")


# --------------------------------------------------------------------------
# 2. Operador: PBKDF2 + JWT
# --------------------------------------------------------------------------
ITERACOES_PBKDF2 = 310_000


def gerar_hash_senha(senha: str, sal: bytes | None = None) -> str:
    sal = sal or secrets.token_bytes(16)
    derivado = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, ITERACOES_PBKDF2)
    return f"pbkdf2_sha256${ITERACOES_PBKDF2}${sal.hex()}${derivado.hex()}"


def conferir_senha(senha: str, armazenado: str) -> bool:
    try:
        _, iteracoes, sal_hex, esperado = armazenado.split("$")
        derivado = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal_hex), int(iteracoes))
    except ValueError:
        return False
    return hmac.compare_digest(derivado.hex(), esperado)


# A senha do operador vem do .env e é convertida em hash na carga; o texto
# puro não fica em memória de longa duração nem em banco.
_HASH_OPERADOR = gerar_hash_senha(config.OPERADOR_SENHA)


def autenticar_operador(usuario: str, senha: str) -> bool:
    usuario_ok = hmac.compare_digest(usuario, config.OPERADOR_USUARIO)
    senha_ok = conferir_senha(senha, _HASH_OPERADOR)
    return usuario_ok and senha_ok


def emitir_token(usuario: str) -> str:
    agora = datetime.now(UTC)
    carga = {"sub": usuario, "papel": "defesa_civil", "iat": agora,
             "exp": agora + timedelta(minutes=config.JWT_MINUTOS)}
    return jwt.encode(carga, config.JWT_SEGREDO, algorithm="HS256")


_bearer = HTTPBearer(auto_error=False)


def operador_atual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "login necessário",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        carga = jwt.decode(cred.credentials, config.JWT_SEGREDO, algorithms=["HS256"],
                           options={"require": ["exp", "sub"]})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "sessão expirada") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token inválido") from None
    if carga.get("papel") != "defesa_civil":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "acesso restrito à Defesa Civil")
    return carga["sub"]


# --------------------------------------------------------------------------
# 3. Limite de tentativas
# --------------------------------------------------------------------------
class LimitadorTentativas:
    def __init__(self, maximo: int = 5, janela_s: int = 300):
        self.maximo, self.janela_s = maximo, janela_s
        self._falhas: dict[str, deque[float]] = defaultdict(deque)

    def checar(self, chave: str) -> None:
        agora = time.monotonic()
        fila = self._falhas[chave]
        while fila and agora - fila[0] > self.janela_s:
            fila.popleft()
        if len(fila) >= self.maximo:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                "muitas tentativas; aguarde alguns minutos",
                                headers={"Retry-After": str(self.janela_s)})

    def falhou(self, chave: str) -> None:
        self._falhas[chave].append(time.monotonic())

    def limpar(self, chave: str) -> None:
        self._falhas.pop(chave, None)


limitador_login = LimitadorTentativas()


def ip_do_cliente(request: Request) -> str:
    return request.client.host if request.client else "desconhecido"


# --------------------------------------------------------------------------
# 4. Dados pessoais
# --------------------------------------------------------------------------
def _chave_fernet() -> bytes:
    if config.CHAVE_DADOS:
        return config.CHAVE_DADOS.encode()
    arquivo = config.BANCO.parent / ".chave_dados"
    if arquivo.exists():
        return arquivo.read_bytes().strip()
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    chave = Fernet.generate_key()
    arquivo.write_bytes(chave)
    log.warning("ALERTACHEIA_CHAVE_DADOS ausente: chave local gerada em %s (não use em produção)", arquivo)
    return chave


_fernet = Fernet(_chave_fernet())


def cifrar(texto: str) -> str:
    return _fernet.encrypt(texto.encode()).decode()


def decifrar(token: str) -> str:
    return _fernet.decrypt(token.encode()).decode()


def hash_telefone(telefone: str) -> str:
    return hmac.new(config.JWT_SEGREDO.encode(), telefone.encode(), hashlib.sha256).hexdigest()


def mascarar_telefone(final: str) -> str:
    return f"(**) *****-{final}"
