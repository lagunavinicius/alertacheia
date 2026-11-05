# 1. A solução: AlertaCheia

> **Aviso de enchente para o seu bairro, antes de a água chegar.**

## Quem é o cidadão beneficiado

O morador de área de risco de inundação nas várzeas e nos córregos de São Paulo.
Ele vive em bairros como Jardim Pantanal e Jardim Romano (Rio Tietê, Zona Leste),
Aricanduva, Pirajuçara e Cabuçu. Muitas vezes é idoso, tem baixa renda, mora em casa
térrea e depende do celular pré-pago, ou só de um vizinho, para saber o que está
acontecendo.

Segundo o IBGE, com base no Censo de 2010 e em parceria com o Cemaden, o Brasil tinha
**8,27 milhões de pessoas morando em áreas de risco** de desastres como enchentes e
deslizamentos. **São Paulo era a capital com mais moradores nessa situação depois de
Salvador: 674.329 pessoas.**
Fonte: [IBGE, *População em áreas de risco no Brasil*](https://www.ibge.gov.br/geociencias/informacoes-ambientais/estudos-ambientais/21538-populacao-em-areas-de-risco-no-brasil.html).

O segundo beneficiado é o **operador da Defesa Civil**. Hoje ele acompanha dezenas de
pontos ao mesmo tempo e precisa decidir para onde mandar equipe.

## Qual problema será resolvido

O aviso chega tarde. Na prática atual, a régua, o alerta só sai quando o nível do córrego
**já passou da cota de alerta**. Numa chuva forte de verão, o nível sai da cota de alerta e
chega ao transbordo em poucas dezenas de minutos. Esse tempo é curto para tirar uma pessoa
acamada de casa, levantar móveis ou retirar o carro da rua. Além disso:

- o aviso, quando chega, vem em linguagem técnica ("cota", "mm/h"), pouco clara para quem
  precisa agir;
- quem tem mobilidade reduzida não tem prioridade no aviso;
- quando a internet ou a energia caem no meio do temporal, a informação some.

## Como a solução funciona

```
 sensor no córrego ──► API ──► modelo de IA ──► pré-alerta (Defesa Civil)
 (nível, chuva,         │       (chance de      └► alerta por SMS com texto
  umidade do solo)      │        transbordar       claro, redigido por IA
                        │        em 2 h)            generativa (morador)
                        └──► Data Lake ──► painel analítico / Power BI
```

1. **Estações IoT** instaladas nos córregos medem, a cada 15 minutos, três coisas: o nível
   da água (ultrassônico), a chuva (pluviômetro) e a umidade do solo. Cada estação também
   decide sozinha e toca uma **sirene local**, que funciona mesmo sem internet.
2. A **API** recebe a leitura, valida e calcula os mesmos atributos usados no treino. Um
   **modelo de IA (Random Forest)** estima a chance de o córrego transbordar nas próximas
   2 horas.
3. Os avisos saem em **dois degraus**, com histerese, para o alerta não ficar ligando e
   desligando:
   - a partir de 60%, **pré-alerta para a Defesa Civil**, com cerca de 1h30 de antecedência;
   - a partir de 80%, **alerta para a população**, com SMS para os moradores cadastrados no
     bairro, cerca de 1h15 antes da água.
4. Um **agente de IA generativa** transforma os números em uma mensagem curta e acionável.
   A mensagem diz qual é o abrigo mais próximo, inclui orientação específica quando há
   morador com mobilidade reduzida, tem versão em áudio e respeita o limite de 160
   caracteres do SMS. Se a IA estiver fora do ar, um gerador determinístico envia o
   alerta do mesmo jeito.
5. Tudo entra num **Data Lake** com as camadas bronze, silver e gold. É ele que alimenta o
   **painel da Defesa Civil** e o **Power BI**: onde agir primeiro, quantas horas cada
   bairro ficou alagado e quanta antecedência o sistema deu.

## Quais tecnologias

| Área | Tecnologias (vistas no curso até a fase 7) |
|---|---|
| IA e automação | Python, scikit-learn (Random Forest), IA generativa (API Claude) com saída JSON validada por esquema, regras de automação com histerese |
| Big Data | Data Lake bronze/silver/gold em JSON Lines e Parquet (pandas, pyarrow), modelo estrela, Power BI com DAX |
| MVP e IoT | Arduino Uno no TinkerCad (HC-SR04, sensor de umidade do solo, potenciômetro, LEDs, buzzer), sensores mock em Python, API FastAPI, frontend React + Vite + Recharts |
| DevOps | Git, Docker, Docker Compose, GitHub Actions (Ruff, Bandit, pip-audit, pytest, Trivy, publicação no GHCR), healthcheck e métricas no formato Prometheus |

## Quem participa do ecossistema

| Ator | Papel |
|---|---|
| **Morador** | se cadastra (com consentimento LGPD), recebe o SMS, ouve o alerta e consulta o bairro |
| **Defesa Civil municipal** | opera o painel, recebe o pré-alerta, despacha equipe, marca o alerta como atendido e treina a equipe com simulações |
| **Lideranças comunitárias / agentes de saúde** | ajudam no cadastro porta a porta, principalmente de idosos e acamados, e servem de ponte com quem não tem celular |
| **Subprefeituras e escolas** | as escolas e CEUs funcionam como abrigos indicados nos alertas |
| **Operadoras de telefonia** | entregam o SMS, que chega mesmo sem internet (canal prioritário em desastres) |
| **Cemaden, CGE e universidades** | podem fornecer dados de radar e de chuva para enriquecer o modelo (ampliação) |

## Como o impacto será medido

| Indicador | Como é medido | Resultado no protótipo |
|---|---|---|
| **Antecedência do aviso** | minutos entre o alerta e o início do transbordo, enchente a enchente | **73,9 min** (SMS) e 88,9 min (pré-alerta), contra **41,8 min** da régua e 0 sem sistema |
| Enchentes sem aviso prévio | enchentes em que o alerta não saiu antes da água | **0 de 14** no período de teste |
| Falsos alarmes | alertas não seguidos de transbordo em 2 h, por semana | 1,4/semana, nível parecido com a régua (1,2) |
| Cobertura | moradores cadastrados ÷ população em área de risco do bairro | no painel ("moradores cadastrados") |
| Alcance | SMS entregues por alerta | no painel ("SMS enviados") |
| Qualidade do dado | completude dos sensores por dia | 100% após a recuperação de lacunas curtas |

## Como o impacto será ampliado

1. **Mais estações, mesmo modelo.** Os atributos são normalizados pela cota de cada
   córrego, então uma estação nova entra só com cadastro e calibração das cotas.
2. **Dados públicos.** Radar meteorológico e previsão de chuva do Cemaden ou do CGE entram
   como novos atributos e aumentam a antecedência.
3. **Novos riscos com a mesma arquitetura.** A umidade do solo, que já é medida, é o
   principal fator de deslizamento. A estação de temperatura atende ondas de calor.
4. **Modelo de negócio.** Para prefeituras, é um serviço por estação instalada, com painel
   e SMS incluídos. Para o morador, é gratuito. A estação custa pouco porque usa
   Arduino/ESP32 e sensores comuns.

## Conexão com os ODS da ONU

| ODS | Como o AlertaCheia contribui |
|---|---|
| **11 · Cidades e comunidades sustentáveis** | meta 11.5: reduzir mortes e perdas causadas por desastres, em especial os relacionados à água, protegendo os mais vulneráveis. O sistema dá cerca de 32 minutos a mais de antecedência que a régua |
| **13 · Ação contra a mudança do clima** | meta 13.1: reforçar a resiliência e a capacidade de adaptação a eventos climáticos extremos; meta 13.3: alerta precoce |
| **10 · Redução das desigualdades** | as áreas alagáveis concentram a população de menor renda; o serviço é gratuito, funciona por SMS (sem internet) e prioriza quem tem mobilidade reduzida |
| **3 · Saúde e bem-estar** | menos exposição a afogamento, choque elétrico e doenças de veiculação hídrica, como a leptospirose |
| **9 · Indústria, inovação e infraestrutura** | infraestrutura de monitoramento de baixo custo, com IoT e IA aplicadas a um serviço público |
