"""Voz neural do alerta: o texto do alerta lido por um modelo Piper em português do Brasil.

O modelo (ONNX, ~60 MB) roda no próprio servidor, sem chave de API e sem mandar o texto
para fora. Cada alerta é sintetizado uma vez (cerca de 0,2 s numa CPU comum) e o WAV fica
em cache no disco. Se o modelo não estiver instalado, a API responde 503 e o navegador
usa a própria voz do sistema.

    python -m piper.download_voices pt_BR-faber-medium --data-dir modelos/voz
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
import threading
import wave

from alertacheia import config

log = logging.getLogger("alertacheia.voz")

_voz = None
_trava = threading.Lock()

# Velocidade um pouco abaixo da natural: quem ouve está assustado, às vezes idoso, às vezes na chuva.
VELOCIDADE = 1.08


def disponivel() -> bool:
    if not config.VOZ_MODELO.exists():
        return False
    try:
        import piper  # noqa: F401
    except ImportError:
        return False
    return True


def _carregar():
    global _voz
    with _trava:
        if _voz is None:
            from piper import PiperVoice

            _voz = PiperVoice.load(str(config.VOZ_MODELO))
    return _voz


def aquecer() -> None:
    """Carrega o modelo e faz uma síntese curta, para a primeira resposta real ser imediata."""
    try:
        audio_wav("Alerta.")
    except Exception as erro:  # noqa: BLE001 - aquecimento nunca derruba a API
        log.warning("voz neural não carregou (%s); o navegador usará a voz do sistema", erro)


def preparar_texto(texto: str) -> str:
    """Palavras em CAIXA ALTA (EMERGÊNCIA, ALERTA) viram normais: o modelo poderia soletrar."""
    return re.sub(r"\b[A-ZÀ-Ý]{3,}\b", lambda m: m.group(0).capitalize(), texto).strip()


def audio_wav(texto: str) -> bytes:
    texto = preparar_texto(texto)
    chave = hashlib.sha256(f"{config.VOZ_MODELO.name}|{VELOCIDADE}|{texto}".encode()).hexdigest()[:32]
    arquivo = config.AUDIO_CACHE / f"{chave}.wav"
    if arquivo.exists():
        return arquivo.read_bytes()

    from piper import SynthesisConfig

    voz = _carregar()
    saida = io.BytesIO()
    with wave.open(saida, "wb") as wav:
        voz.synthesize_wav(texto, wav, syn_config=SynthesisConfig(length_scale=VELOCIDADE))
    dados = saida.getvalue()
    config.AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    arquivo.write_bytes(dados)
    return dados
