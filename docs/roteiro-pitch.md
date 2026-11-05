# Roteiro do vídeo pitch (até 3:00)

**Regra do enunciado:** o vídeo tem que mostrar o protótipo funcionando, e não slides. Grave a
tela com OBS ou com a Barra de Jogos do Windows (Win+Alt+R) e narre por cima. Use 1080p.

## Preparação (antes de gravar)

1. `python run_pipeline.py` e depois `python -m api.main`.
2. Apague o banco de demonstração para começar limpo: feche a API, apague `data/alertacheia.db`
   e suba de novo.
3. Abra numa janela `http://localhost:8080/` com o bairro **Vila Aricanduva** selecionado.
4. Noutra aba, faça login no **painel da Defesa Civil**.
5. Deixe o TinkerCad aberto, com o circuito da EST-03 montado.
6. Opcional: um terminal pronto com `python -m iot.serial_para_api iot/exemplo_serial_tinkercad.txt --intervalo 1.5`.

## Roteiro

| Tempo | Bloco | Na tela | Fala (sugestão) |
|---|---|---|---|
| **0:00–0:30** | **O problema** | foto ou vídeo de rua alagada (ex.: Jardim Pantanal) e depois a tela "Meu bairro" | "Em São Paulo, mais de 670 mil pessoas moram em área de risco, segundo o IBGE. Quando o córrego enche, o aviso de hoje só sai quando a água já passou da régua. Isso dá menos de 45 minutos para tirar a família, os documentos e quem não consegue andar. A Dona Maria, do Aricanduva, mora com a mãe acamada. Para ela, meia hora faz toda a diferença." |
| **0:30–0:50** | **A solução** | tela de estações (mapa) | "O AlertaCheia usa sensores baratos nos córregos e uma IA que prevê o transbordo duas horas antes. O aviso chega por SMS, em linguagem simples, cerca de uma hora antes da água." |
| **0:50–1:20** | **Demo: IoT** | TinkerCad: aproximar o objeto do sensor ultrassônico, LED amarelo e depois vermelho com sirene; Monitor Serial | "Essa é a estação, num Arduino. Ela mede o nível, a chuva e a umidade do solo. Quando a água sobe, ela acende o LED e toca a sirene do bairro, mesmo sem internet." |
| **1:20–1:50** | **Demo: IA em ação** | painel → "Simular chuva" (Temporal, Vila Aricanduva). Mostrar o pré-alerta e depois o alerta com "SMS para 1 morador" | "Começou o temporal. Repare: o córrego ainda está em 36% do limite, e a IA já calculou 74% de chance de transbordar. A Defesa Civil recebe o pré-alerta. Quinze minutos depois, o SMS sai para a Dona Maria. A mensagem foi escrita pela IA generativa e traz o abrigo mais próximo e uma orientação para quem tem dificuldade de andar." |
| **1:50–2:10** | **Demo: cidadão e dashboard** | aba "Meu bairro" em ALERTA → clicar em "Ouvir o alerta" (deixar tocar 3 s) → rolar o painel: indicadores, filtro por bairro, gráfico | "É isso que ela vê no celular, e pode ouvir se não enxerga bem. A Defesa Civil vê no painel onde agir primeiro: aqui, Pirajuçara e Cabuçu concentram as horas de alagamento." |
| **2:10–2:40** | **Impacto + ODS** | painel, card "Desempenho do modelo" (barras de antecedência) | "Nas 14 enchentes do teste, o AlertaCheia avisou em média 74 minutos antes, contra 42 da régua atual: 32 minutos a mais, sem aumentar os alarmes falsos. Nenhuma enchente ficou sem aviso. Isso atende aos ODS 11 e 13, de cidades resilientes e alerta precoce, e ao ODS 10, porque a área alagável é onde mora quem tem menos." |
| **2:40–3:00** | **Fechamento** | tela "Meu bairro" de volta ao normal + logo | "Sensor de baixo custo, IA que antecipa, mensagem que qualquer pessoa entende, tudo testado e entregue num container por um pipeline automático. O AlertaCheia transforma meia hora em vidas protegidas. Obrigado." |

## Checklist do vídeo (vale 5 pontos)

- [ ] Até **3:00** (o que passar disso não é avaliado)
- [ ] Mostra as 4 áreas: **IA** (alerta + chance), **dashboard** (painel com filtro), **protótipo + sensor** (TinkerCad) e, de passagem, Docker/CI (2 s da aba Actions verde)
- [ ] Cita um dado real (IBGE) e o resultado medido (+32 min)
- [ ] Link **público** (YouTube não listado ou Drive "qualquer pessoa com o link"), testado numa aba anônima
- [ ] Link colado no `GRUPO.txt` **e** no `README.md`
