# AlertaCheia: imagem única com API, modelo treinado e frontend compilado.
#
#   docker build -t alertacheia .
#   docker run -p 8080:8080 alertacheia      ->  http://localhost:8080
#
# Estágio 1 compila o React; estágio 2 instala o Python, reconstrói o Data Lake
# e treina o modelo (determinístico, semente fixa), e roda como usuário sem root.

FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ALERTACHEIA_HOST=0.0.0.0 \
    ALERTACHEIA_PORTA=8080
WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY alertacheia/ alertacheia/
COPY dados/ dados/
COPY ia/prompts.py ia/alerta_generativo.py ia/modelo.py ia/treinar.py ia/__init__.py ia/
COPY api/ api/
COPY iot/ iot/
COPY run_pipeline.py ./
COPY --from=frontend /app/frontend/dist frontend/dist

# Data Lake + modelo dentro da imagem: o container sobe pronto, sem passo manual
RUN python run_pipeline.py \
    && useradd --create-home --uid 10001 alerta \
    && mkdir -p /app/data \
    && chown -R alerta:alerta /app/data /app/datalake /app/docs

USER alerta
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/saude', timeout=4).status == 200 else 1)"

CMD ["python", "-m", "api.main"]
