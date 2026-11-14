# Roteiro do vídeo pitch (até 3:00)

**Regra do enunciado:** o vídeo tem que mostrar o protótipo funcionando, e não slides. Grave a
tela com OBS ou com a Barra de Jogos do Windows (Win+Alt+R) e narre por cima. Use 1080p, navegador
em tela cheia (F11) e zoom de 100%.

## Preparação (antes de gravar)

1. Se ainda não fez: `python run_pipeline.py` e baixe a voz neural (comando no README).
2. **Comece limpo, logo antes de gravar:** feche a API, apague `data/alertacheia.db` e suba de novo
   com `python -m api.main`. Isso importa por dois motivos: os alertas antigos somem, e o site
   não mostra o aviso "Sem leitura nova" (ele aparece quando a API fica mais de 45 minutos parada
   sem receber leitura).
3. Cadastre a Dona Maria em `http://localhost:8080/cadastro`: bairro **Vila Aricanduva**, SMS e
   "mora alguém com dificuldade para andar". Sem esse cadastro, o painel mostra "SMS para 0
   morador(es)".
4. Aba 1: `http://localhost:8080/` com **Vila Aricanduva** escolhido no seletor de bairro.
5. Aba 2: login no **painel da Defesa Civil** (`/painel/login`).
6. Deixe o TinkerCad aberto, com o circuito da EST-03 montado.
7. Opcional: um terminal pronto com `python -m iot.serial_para_api iot/exemplo_serial_tinkercad.txt --intervalo 1.5`.
8. Ensaie a simulação uma vez **antes** e repita o passo 2. A chuva simulada leva cerca de 25 s,
   e é bom saber em que momento os avisos aparecem.

## Roteiro

| Tempo | Bloco | Na tela | Fala (sugestão) |
|---|---|---|---|
| **0:00–0:30** | **O problema** | foto ou vídeo de rua alagada (ex.: Jardim Pantanal) e depois a tela "Meu bairro", com a água azul no nível normal | "Em São Paulo, mais de 670 mil pessoas moram em área de risco, segundo o IBGE. Quando o córrego enche, o aviso de hoje só sai quando a água já passou da régua. Isso dá menos de 45 minutos para tirar a família, os documentos e quem não consegue andar. A Dona Maria, do Aricanduva, mora com a mãe acamada. Para ela, meia hora faz toda a diferença." |
| **0:30–0:50** | **A solução** | aba "Mapa": o mapa real de São Paulo com as 5 estações e a lista "Do maior para o menor risco" | "O AlertaCheia usa sensores baratos nos córregos e uma IA que prevê o transbordo duas horas antes. O aviso chega por SMS, em linguagem simples, cerca de uma hora antes da água." |
| **0:50–1:20** | **Demo: IoT** | TinkerCad: aproximar o objeto do sensor ultrassônico, LED amarelo e depois vermelho com sirene; Monitor Serial | "Essa é a estação, num Arduino. Ela mede o nível, a chuva e a umidade do solo. Quando a água sobe, ela acende o LED e toca a sirene do bairro, mesmo sem internet." |
| **1:20–1:50** | **Demo: IA em ação** | painel → quadro "Treinar a equipe com uma chuva simulada": Estação **Vila Aricanduva**, Cenário **Temporal**, "Simular chuva". O marcador do mapa fica laranja e pulsa, os avisos aparecem no canto da tela e a fila "Alertas da operação" (à direita) mostra o pré-alerta e depois "SMS para 1 morador(es)" | "Começou o temporal. Repare: o córrego ainda está abaixo da metade do limite, e a IA já calcula perto de 80% de chance de transbordar. A Defesa Civil recebe o pré-alerta. Na leitura seguinte, o SMS sai para a Dona Maria. A mensagem foi escrita pela IA generativa e traz o abrigo mais próximo e uma orientação para quem tem dificuldade de andar." |
| **1:50–2:10** | **Demo: cidadão e dashboard** | aba "Meu bairro": a água subiu além da linha laranja do limite, selo "Emergência" → abrir o seletor de bairro (mostra o risco de cada bairro) e fechar → clicar em "Ouvir o alerta" (deixar a voz tocar 3 s) → no painel, aba "Histórico da estação chuvosa": indicadores e a tabela "Onde agir primeiro" | "É isso que ela vê no celular: a água subindo até passar do limite do córrego. Se não enxerga bem, ela ouve o alerta, numa voz neural gerada no próprio servidor. A Defesa Civil vê no painel onde agir primeiro: aqui, Pirajuçara e Vila Aricanduva concentram as horas de alagamento." |
| **2:10–2:40** | **Impacto + ODS** | painel, aba "Modelo de IA": barras "Quanto tempo antes da água o aviso chega" e o quadro "Desempenho no teste" | "Nas 14 enchentes do teste, o AlertaCheia avisou em média 74 minutos antes, contra 42 da régua atual: 32 minutos a mais, com praticamente o mesmo número de alarmes falsos. Nenhuma enchente ficou sem aviso. Isso atende aos ODS 11 e 13, de cidades resilientes e alerta precoce, e ao ODS 10, porque a área alagável é onde mora quem tem menos." |
| **2:40–3:00** | **Fechamento** | tela "Meu bairro" num bairro em situação normal (ex.: Cabuçu) + logo | "Sensor de baixo custo, IA que antecipa, mensagem que qualquer pessoa entende, tudo testado e entregue num container por um pipeline automático. O AlertaCheia transforma meia hora em vidas protegidas. Obrigado." |

### De onde vêm os números da fala

| Número | Onde conferir |
|---|---|
| 74 min (IA) × 42 min (régua), 14 enchentes, 0 sem aviso | painel → aba "Modelo de IA" (e `ia/artefatos/metricas.json`: 73,9 × 41,8) |
| alarmes falsos: 1,4 por semana (SMS) × 1,2 (régua) | mesmo quadro, linha "Falsos alarmes/semana" |
| pré-alerta com o córrego abaixo da metade do limite e ~80% de chance | fila "Alertas da operação" durante a simulação; o valor varia um pouco a cada rodada, então fale o que aparecer na tela |
| bairros com mais horas de alagamento | painel → "Onde agir primeiro" (Pirajuçara 49,8 h; Vila Aricanduva 43 h) |
| 670 mil pessoas em área de risco | IBGE: confira a fonte e cite-a na descrição do vídeo |

## Checklist do vídeo (vale 5 pontos)

- [ ] Até **3:00** (o que passar disso não é avaliado)
- [ ] Mostra as 4 áreas: **IA** (alerta + chance), **dashboard** (painel com filtro), **protótipo + sensor** (TinkerCad) e, de passagem, Docker/CI (2 s da aba Actions verde)
- [ ] Cita um dado real (IBGE) e o resultado medido (+32 min)
- [ ] Link **público** (YouTube não listado ou Drive "qualquer pessoa com o link"), testado numa aba anônima
- [ ] Link colado no `GRUPO.txt` **e** no `README.md`
