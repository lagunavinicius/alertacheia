# Área 2: Big Data e visualização

## 1. Estrutura dos dados: Data Lake em camadas (1 pt)

```
datalake/
├── bronze/                       dado bruto, imutável: a prova do que foi recebido
│   ├── leituras/data=AAAA-MM-DD/EST-xx.jsonl        histórico (120 dias, 5 estações)
│   └── tempo_real/data=AAAA-MM-DD/EST-xx.jsonl      tudo que chega pela API (sensores, TinkerCad)
├── silver/leituras.parquet       validado, sem duplicata, grade de 15 min, lacunas marcadas
├── quarentena/leituras_rejeitadas.parquet           o que foi recusado, com o motivo
└── gold/                         modelo estrela, em Parquet e CSV (; e vírgula decimal, para o Power BI)
    ├── dim_estacao               bairro, córrego, cotas, população em risco, abrigo
    ├── dim_calendario            data, mês, semana, dia da semana, fim de semana
    ├── fato_leituras             1 linha por estação a cada 15 min + atributos do modelo + alvo
    ├── fato_leituras_hora        agregado por hora: nível máx./médio, chuva, minutos acima do transbordo
    ├── fato_eventos              1 linha por enchente: início, duração, pico, chuva, antecedência IA × régua
    ├── fato_previsoes            probabilidade e risco calculados pelo modelo, a cada 15 min
    └── fato_qualidade            por estação e dia: recebidas, em quarentena, imputadas, completude
```

**Por que cada camada existe:**

| Camada | Função |
|---|---|
| **bronze** | Nunca é alterada. Se uma regra de limpeza estiver errada, dá para reprocessar tudo a partir dela. É particionada por dia, como chegaria de um broker de mensagens |
| **silver** | Uma fonte confiável para qualquer uso: não tem leitura impossível nem duplicada, e toda lacuna é explícita (`imputado`, `sem_sinal`) |
| **gold** | Pronta para decidir: modelo estrela com chave `estacao_id` (para `dim_estacao`) e chave `data` (para `dim_calendario`). Alimenta o Power BI, o treino do modelo e o painel da Defesa Civil |
| **quarentena** | Nada é apagado em silêncio. O motivo de cada rejeição fica registrado, para auditoria e para a manutenção dos sensores |

**Modelo estrela (gold):**

```
                 dim_calendario (data)
                        │ 1
        ┌───────────────┼──────────────┬──────────────┐
        * │             * │            * │             * │
 fato_leituras_hora  fato_eventos  fato_qualidade  fato_previsoes
        * │             * │            * │             * │
        └───────────────┴──────┬───────┴──────────────┘
                               │ 1
                          dim_estacao (estacao_id)
```

## 2. Ingestão e processamento: da coleta ao dado tratado (1 pt)

```
 sensor/TinkerCad ─► POST /api/leituras ─► bronze/tempo_real (JSON Lines, append)
 histórico ────────► dados/gerador.py ───► bronze/leituras
                                              │
                         dados/pipeline.py    ▼
   1. ler_bronze      lê as duas zonas; linha que não é JSON vira registro com erro
   2. validar         tipos, estação existente, timestamp, faixas físicas ──► quarentena (+ motivo)
   3. para_silver     deduplica (estação+horário) · grade de 15 min · lacuna ≤ 30 min interpolada
                      e marcada · lacuna > 6 h vira segmento separado (não inventa meses de "sem sinal")
   4. fato_*          atributos do modelo (mesma função da API) · alvo transbordo_2h · agregações
   5. ia/treinar.py   treina, avalia e grava fato_previsoes e a antecedência em fato_eventos
```

O comando `python run_pipeline.py` reconstrói tudo em cerca de 4 segundos.

Execução real (`datalake/gold/_resumo_pipeline.json`):

| Etapa | Registros |
|---|---|
| bronze recebidas | 57.466 |
| quarentena | 314 (153 nível vazio · 109 nível fora da faixa, como −50 cm ou 9.999 cm · 52 umidade > 100%) |
| duplicadas removidas | 330 |
| leituras imputadas (lacunas curtas) | 411 |
| instantes sem sinal (lacunas longas, não inventadas) | 367 |
| silver | 57.600 linhas (5 estações × 120 dias × 96 leituras) |
| gold · fato_leituras | 57.233 |
| enchentes identificadas | 40 |

## 3. Dashboard: 3+ indicadores com filtros para decidir (1,5 pt)

São dois dashboards sobre a mesma camada gold.

### 3.1 Painel da Defesa Civil (web, dentro do MVP)

Fica em `/painel`, protegido por login. **Filtros:** estação, data inicial e data final.

**Indicadores:**
1. Enchentes no período e pessoas em área de risco
2. **Antecedência média do aviso (IA) e ganho sobre a régua**
3. Horas acima da cota de transbordo
4. Chuva acumulada (média por estação)
5. Completude dos sensores
6. Moradores cadastrados e SMS enviados

**Visuais:**
- chuva diária × nível máximo em % da cota, com a linha de transbordo;
- tabela "Onde agir primeiro", com os bairros ordenados por horas alagadas;
- lista de enchentes com a antecedência da IA × régua;
- comparação de antecedência entre o modelo, a régua e a operação sem sistema;
- faixa ao vivo das 5 estações.

**Decisões que ele apoia:**
- para qual bairro mandar a equipe primeiro;
- onde intensificar o cadastro de moradores (cobertura baixa em bairro com muitas horas alagadas);
- qual estação precisa de manutenção (completude baixa).

### 3.2 Power BI (`powerbi/`)

Monte o relatório com o passo a passo de `powerbi/README.md`. Ele usa os CSVs da gold, o
modelo estrela acima e as medidas DAX de `powerbi/medidas.dax`. O relatório tem três páginas:
"Visão geral", "Onde agir primeiro" e "Qualidade do dado".

## 4. Funções analíticas: DAX (0,5 pt)

As medidas completas estão em `powerbi/medidas.dax`. Destaques:

```dax
Ganho de Antecedência (min) = [Antecedência IA (min)] - [Antecedência Régua (min)]

Horas Acima do Transbordo = DIVIDE ( SUM ( fato_leituras_hora[minutos_acima_transbordo] ), 60 )

Chuva Média por Estação (mm) =
    AVERAGEX ( VALUES ( dim_estacao[estacao_id] ), CALCULATE ( SUM ( fato_leituras_hora[chuva_mm] ) ) )

Nível Máx. % da Cota =
    MAXX ( fato_leituras_hora,
           DIVIDE ( fato_leituras_hora[nivel_max_cm], RELATED ( dim_estacao[cota_transbordo_cm] ) ) )

Ranking de Risco =
    RANKX ( ALL ( dim_estacao[bairro] ), [Horas Acima do Transbordo], , DESC, DENSE )

Prioridade =
    VAR horas = [Horas Acima do Transbordo]
    VAR semAviso = [Enchentes sem Aviso Prévio]
    RETURN SWITCH ( TRUE (), semAviso > 0, "Revisar estação", horas >= 30, "Prioridade 1",
                    horas >= 10, "Prioridade 2", "Monitorar" )
```

No código, as mesmas métricas existem em `api/servico.py` (`painel_resumo`), que calcula os
indicadores do painel web com pandas sobre a mesma gold.
