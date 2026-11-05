# Área 3: MVP, IoT e experiência digital

## 1. Protótipo: 7 telas funcionais (1 pt)

São telas em React + Vite, servidas pela própria API em `http://localhost:8080`.

| # | Tela | Rota | Para quem | O que faz |
|---|---|---|---|---|
| 1 | **Meu bairro** | `/` | morador | status do bairro em linguagem simples, mensagem da IA, "o que fazer agora", **ouvir o alerta** (voz), abrigo mais próximo, nível e chance de transbordo |
| 2 | **Estações** | `/estacoes` | morador | mapa esquemático com as 5 estações coloridas pelo risco + cartões com o nível em relação à cota |
| 3 | **Detalhe da estação** | `/estacoes/:id` | morador / técnico | nível e chuva das últimas 24 h com as cotas, chance de transbordo calculada pela IA e motivos do alerta |
| 4 | **Alertas** | `/alertas` | morador | histórico dos alertas, com o SMS enviado e a origem do texto (IA ou determinístico) |
| 5 | **Receber alertas** | `/cadastro` | morador | cadastro com consentimento LGPD, canal (SMS ou WhatsApp), mobilidade reduzida e **descadastro** |
| 6 | **Login** | `/painel/login` | Defesa Civil | autenticação (JWT, 1 h) |
| 7 | **Painel da Defesa Civil** | `/painel` | Defesa Civil | estações ao vivo, alertas da operação (marcar atendido), simulação de chuva, indicadores com filtros e desempenho do modelo |

**Acessibilidade e inclusão:**
- botões de **letra grande** e **alto contraste**;
- **leitura do alerta em voz alta** (Web Speech API);
- link "pular para o conteúdo";
- `aria-live` no status do bairro;
- foco visível e alvos de toque de 48 px;
- respeito a `prefers-reduced-motion`;
- linguagem sem jargão;
- **funciona sem conexão**: a última resposta fica guardada no aparelho, e a tela avisa o
  horário dela e o telefone 199;
- no celular, **barra de navegação inferior** com os 4 destinos do morador, ao alcance do polegar;
- **erros de formulário junto de cada campo**, em português simples, ligados por
  `aria-describedby`, e o foco vai para o primeiro campo com problema;
- selos de risco com contraste AA (4,5:1 ou mais) e alvos de toque de 44 px ou mais;
- a fonte **Barlow** (OFL, auto-hospedada), da mesma família DIN da marca, aparece igual em
  qualquer aparelho;
- as telas com gráficos carregam sob demanda, e "Meu bairro" baixa 71 kB de JS (gzip), não 177 kB.

## 2. IoT: 3 sensores e 4 atuadores (1 pt)

| Onde | O quê |
|---|---|
| `iot/estacao_cheia/estacao_cheia.ino` | sketch do Arduino Uno para o TinkerCad |
| `iot/GUIA_TINKERCAD.md` | lista de componentes, pinagem e passo a passo |
| `iot/serial_para_api.py` | ponte Monitor Serial (CSV) → API |
| `iot/exemplo_serial_tinkercad.txt` | captura de um temporal, para rodar sem o TinkerCad |
| `iot/simulador.py` | **sensores mock**: as 5 estações publicando na API, com a mesma física do histórico |

**Sensores:**
- **HC-SR04 ultrassônico** → nível da água (cm). O sensor fica preso na ponte, e o nível é a
  altura do sensor menos a distância medida;
- **sensor de umidade do solo** → encharcamento (%). Ele só é energizado na hora da leitura,
  pelo pino D8, para reduzir a corrosão;
- **potenciômetro** → pluviômetro (mm/15 min). O TinkerCad não tem pluviômetro.

**Atuadores:**
- LEDs verde, amarelo e vermelho;
- **sirene (buzzer)**.

**Decisão na borda.** O Arduino decide sozinho entre OK, ATENÇÃO e TRANSBORDO e toca a sirene.
Isso funciona **sem internet**: é o plano B do bairro quando a rede cai no temporal. Quando o
sensor não recebe eco, ele publica `SEM_ECO` com nível −1, e a API recusa essa leitura com 422.

> **Evidência a incluir no PDF:** print do circuito montado no TinkerCad e do Monitor Serial
> com a simulação rodando (seção de evidências).

## 3. Fluxo funcional: um uso completo, do início ao fim (1 pt)

O teste automatizado CT-16 reproduz este fluxo.

1. **Dona Maria se cadastra** em `/cadastro`: bairro Vila Aricanduva, SMS, marca "mora alguém
   com dificuldade para andar" e dá o consentimento LGPD. O telefone é cifrado e aparece
   mascarado.
2. **Começa um temporal.** A estação EST-03 publica uma leitura a cada 15 minutos:
   - pelo TinkerCad: `python -m iot.serial_para_api iot/exemplo_serial_tinkercad.txt`;
   - pelos sensores mock: `python -m iot.simulador --tempestade EST-03`;
   - pelo botão **"Simular chuva"** do painel.
3. **A IA percebe antes.** Com o nível ainda em 36% da cota, a chance passa de 60%: o
   **pré-alerta** aparece no painel da Defesa Civil.
4. **Uma leitura depois**, a chance passa de 80%. A IA generativa redige o alerta e o **SMS é
   enviado** para a Dona Maria (`data/sms_enviados.log`, número mascarado). O alerta inclui a
   orientação para quem tem mobilidade reduzida.
5. **"Meu bairro" muda para ALERTA.** Ela pode **ouvir o alerta** e vê o abrigo mais próximo.
6. **A água passa da cota:** EMERGÊNCIA, com novo SMS ("saia agora") e a sirene da estação tocando.
7. **A Defesa Civil marca o alerta como atendido** no painel. A ação fica registrada na auditoria.
8. **A chuva passa.** Depois de 1 h com chance abaixo de 30%, os alertas são encerrados.
9. **As leituras do temporal entram no Data Lake** (`bronze/tempo_real`). Na próxima execução
   do pipeline, elas aparecem na gold, no painel e no Power BI.

## 4. Arquitetura geral (1 pt)

O diagrama está em `docs/arquitetura.svg` (também no PDF).

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Estação | Arduino (TinkerCad) / mock Python | medir, decidir na borda, publicar |
| API | FastAPI + SQLite | autenticar o sensor, validar, rodar o modelo, máquina de estados, notificar, servir o frontend |
| IA | scikit-learn + API Claude | prever o transbordo e redigir o alerta |
| Data Lake | JSON Lines + Parquet (pandas/pyarrow) | histórico bronze → silver → gold |
| Painéis | React (web) + Power BI | decisão da Defesa Civil |
| Entrega | Docker + GitHub Actions + GHCR | build, testes, segurança e publicação automáticos |

**Como as áreas se conectam (diferencial "áreas integradas"):**
- o **sensor** publica na API;
- a API roda a **IA** e grava no **bronze**;
- o pipeline leva o dado à **gold**;
- a gold **treina o modelo** e alimenta o **dashboard**;
- o **CI/CD** testa e empacota tudo isso numa imagem.
