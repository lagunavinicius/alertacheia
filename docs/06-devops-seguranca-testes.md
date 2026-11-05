# Área 4: DevOps, segurança e qualidade

## 1. Organização: módulos e Git (0,5 pt)

```
GlobalSolution/
├── alertacheia/   núcleo compartilhado: config (cotas, limiares), atributos, hidrologia
├── dados/         Área 2: gerador do histórico e pipeline bronze → silver → gold
├── ia/            Área 1: treino/avaliação, modelo, prompts e agente generativo
├── api/           backend FastAPI: rotas, segurança, banco, regras de negócio
├── iot/           Área 3: sketch TinkerCad, ponte serial, sensores mock
├── frontend/      Área 3: MVP React (7 telas)
├── powerbi/       Área 2: medidas DAX e roteiro do relatório
├── tests/         Área 4: 32 testes automatizados (pytest)
├── docs/          documentação por área, arquitetura e evidências
├── .github/workflows/ci.yml   pipeline CI/CD
├── Dockerfile · docker-compose.yml · pyproject.toml (Ruff, pytest, Bandit)
└── run_pipeline.py            reconstrói Data Lake + modelo + exemplo da IA
```

O projeto é versionado com Git. O que é gerado (Data Lake, modelo, banco, `node_modules`) e
os segredos (`.env`) ficam no `.gitignore`: tudo isso se reconstrói com `python run_pipeline.py`.

## 2. DevOps: Docker, CI/CD e monitoramento (1 pt)

### Docker

- **`Dockerfile` multi-stage:**
  - o estágio Node compila o React;
  - o estágio Python instala as dependências e **reconstrói o Data Lake e o modelo dentro da
    imagem**, com semente fixa e resultado determinístico.

  Assim, o container sobe pronto, sem passo manual. Ele roda como **usuário sem root** (uid
  10001) e tem `HEALTHCHECK` em `/api/saude`.
- **`docker-compose.yml`:**
  - serviço `api`, com volume para o banco e healthcheck;
  - perfil `demo`, com o serviço `sensores` (as 5 estações mock publicando na API pela rede
    do compose).

Evidências: `docs/evidencias/docker_build.log` e `docs/evidencias/docker_smoke_test.txt`. No
smoke test, o container ficou `healthy`, com o modelo carregado e 960 leituras semeadas; a
leitura sem chave deu 401 e o frontend foi servido.

### CI/CD: `.github/workflows/ci.yml` (diferencial "pipeline ponta a ponta")

```
push / pull request
   ├─ qualidade   Ruff (lint + regras de segurança S)
   ├─ seguranca   Bandit (SAST) + pip-audit --strict (SCA)
   ├─ testes      pytest -v + cobertura + relatório JUnit (artefato) + resumo no GitHub
   └─ frontend    npm ci + vite build
          ▼ (só se os 4 passarem)
   docker   build → sobe o container → smoke test (saúde, estações, 401 sem chave, frontend)
            → Trivy (falha com CVE crítica corrigível)
          ▼ (só na main)
   deploy   publica a imagem no GitHub Container Registry (ghcr.io/<repo>:<sha> e :latest)
```

**Um commit na `main` dispara build, testes e deploy, sem nenhum passo manual.**

> Para o pipeline rodar, a pasta `GlobalSolution/` precisa ser a raiz de um repositório no
> GitHub (o GitHub só lê `.github/workflows` da raiz). Evidência a incluir no PDF: print da aba
> **Actions** com os jobs verdes e o resumo dos testes.

### Monitoramento

| Recurso | O que oferece |
|---|---|
| `GET /api/saude` | estado do serviço, modelo carregado, gold disponível, última leitura recebida e uptime. Usado pelo healthcheck do Docker |
| `GET /api/metricas` | formato **Prometheus**: requisições por rota e status, risco atual por estação (0 a 3), alertas emitidos e uptime |
| Logs em **JSON** | um por evento: alerta emitido, estado semeado, falha da IA com o fallback usado |
| Trilha de **auditoria** | `GET /api/painel/auditoria` registra logins (ok e falha), cadastros, exclusões, simulações e atendimentos |

## 3. Segurança: 7 práticas (0,5 pt; o mínimo pedido é 2)

| # | Prática | Onde |
|---|---|---|
| 1 | **Autenticação do sensor com chave por estação** (HMAC-SHA256 de um segredo mestre). A chave da EST-01 não publica pela EST-02 | `api/seguranca.py` · CT-10 |
| 2 | **Autenticação do operador:** senha com PBKDF2-SHA256 (310 mil iterações) e **JWT** HS256 com expiração de 60 min e papel `defesa_civil` | `api/seguranca.py` · CT-13 |
| 3 | **Limite de tentativas de login** por IP: 5 em 5 min, depois 429 | CT-14 |
| 4 | **Validação de entrada** (Pydantic): faixas físicas, formato de estação e telefone, `extra="forbid"`, SQL sempre parametrizado | `api/esquemas.py` · CT-11 |
| 5 | **Proteção de dados (LGPD):** consentimento obrigatório, telefone **cifrado** (Fernet), busca por HMAC, sempre mascarado, decifrado só no envio, e **direito de exclusão** | CT-15, CT-16 |
| 6 | **Cabeçalhos de segurança:** CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, CORS restrito; erros sem stack trace | `api/main.py` · CT-18 |
| 7 | **Proteção do agente de IA contra prompt injection:** dados delimitados e tratados como dado, saída por esquema, limite do SMS checado em código | `ia/prompts.py` |

Também fazem parte: segredos fora do Git (`.env`), container sem root, Bandit, pip-audit e
Trivy no CI. Na execução local, Bandit e pip-audit não acusaram nenhum problema.

## 4. Testes: plano com 18 casos e evidência (1 pt)

O comando `pytest` roda **32 execuções**: o CT-08 roda em 15 combinações (5 estações × 3
riscos). Os testes reconstroem o Data Lake e o modelo numa pasta temporária, então nunca tocam
os dados do projeto.

| ID | Objetivo | Entrada / passos | Resultado esperado | Status |
|---|---|---|---|---|
| CT-01 | Quarentena retém dado inválido | bronze com nível vazio, −50 cm e 9.999 cm | rejeitados com motivo; silver só com valores na faixa | ✅ |
| CT-02 | Sem duplicata na silver | reenvios do sensor | nenhuma (estação, horário) repetida | ✅ |
| CT-03 | Lacunas | falta de 15 min e de 2 h | 15 min interpolado e marcado; 2 h fica "sem sinal" | ✅ |
| CT-04 | Mesmos atributos no treino e ao vivo | janela de 97 leituras × gold | diferença < 1e-6 em todos os atributos | ✅ |
| CT-05 | Modelo avisa antes da água | temporal simulado na EST-03 | P ≥ 0,80 antes de o nível chegar à cota; tempo seco < 0,30 | ✅ |
| CT-06 | Portão de qualidade da IA | métricas do teste | ROC AUC ≥ 0,90, antecedência > régua, 0 enchente sem aviso | ✅ |
| CT-07 | Histerese | probabilidade oscilando | alerta não "pisca"; liga uma vez, desliga uma vez | ✅ |
| CT-08 | SMS válido (15 combinações) | 5 estações × 3 riscos, com mobilidade reduzida | ≤ 160 caracteres, cita bairro e 199, orientação de mobilidade | ✅ |
| CT-09 | IA fora do ar | chamada ao modelo lança ConnectionError | alerta sai pelo fallback e registra a falha | ✅ |
| CT-10 | Chave do sensor | sem chave / chave de outra estação / chave certa | 401 / 401 / 201 | ✅ |
| CT-11 | Validação de entrada | 9.999 cm, −1 cm, campo extra, estação inexistente, `' OR 1=1 --` | 422 em todos | ✅ |
| CT-12 | Idempotência + bronze | mesma leitura duas vezes | 201, depois 200 `duplicada`; linha no bronze/tempo_real | ✅ |
| CT-13 | Painel protegido | sem token / token adulterado / token válido | 401 / 401 / 200 | ✅ |
| CT-14 | Força bruta | 5 senhas erradas e depois a certa | 401 × 5, depois 429 | ✅ |
| CT-15 | LGPD | sem consentimento; telefone no banco; exclusão | 422; banco sem o número legível; resposta mascarada; removido | ✅ |
| CT-16 | **Fluxo ponta a ponta** | cadastro → temporal → painel | pré-alerta + alerta + SMS para 1 morador, visível ao cidadão, atendido | ✅ |
| CT-17 | Monitoramento | `/api/saude`, `/api/metricas` | status ok, modelo carregado, métricas Prometheus | ✅ |
| CT-18 | Cabeçalhos de segurança | GET público | CSP, X-Frame-Options, nosniff | ✅ |

**Evidências:**
- `docs/evidencias/pytest.txt`: saída do `pytest -v`, 32 testes passando;
- `docs/evidencias/qualidade_seguranca.txt`: saída do Ruff, do Bandit e do pip-audit;
- no GitHub Actions: artefato `relatorio-testes` (JUnit + cobertura) e o resumo do job.
