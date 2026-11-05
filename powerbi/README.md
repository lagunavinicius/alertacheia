# Dashboard Power BI do AlertaCheia

O arquivo `.pbix` é montado no Power BI Desktop a partir dos CSVs da camada gold.
Leva uns 20 minutos.

## 1. Gerar os dados

```bash
python run_pipeline.py
```

Os CSVs ficam em `datalake/gold/`, com separador `;`, vírgula decimal e UTF-8.

## 2. Importar (Página Inicial → Obter dados → Texto/CSV)

Importe os 5 arquivos abaixo. Em cada um, confira na pré-visualização se o delimitador está
como **Ponto e vírgula** e clique em **Transformar dados**.

| Arquivo | Ajuste de tipo no Power Query |
|---|---|
| `dim_estacao.csv` | nenhum |
| `dim_calendario.csv` | `data` → Data |
| `fato_leituras_hora.csv` | `ts_hora` → Data/Hora · `data` → Data |
| `fato_eventos.csv` | `inicio`, `fim` → Data/Hora · `data` → Data |
| `fato_qualidade.csv` | `data` → Data |

Se a vírgula decimal não for reconhecida (Windows em inglês), use em cada coluna numérica a
opção **Alterar tipo → Usando localidade → Número decimal / Português (Brasil)**.

## 3. Relacionamentos (Exibição de modelo)

| De (1) | Para (*) |
|---|---|
| `dim_estacao[estacao_id]` | `fato_leituras_hora[estacao_id]`, `fato_eventos[estacao_id]`, `fato_qualidade[estacao_id]` |
| `dim_calendario[data]` | `fato_leituras_hora[data]`, `fato_eventos[data]`, `fato_qualidade[data]` |

Use direção de filtro única e marque `dim_calendario` como tabela de datas.

## 4. Medidas

Crie a tabela `_Medidas` e cole as medidas de [`medidas.dax`](medidas.dax).

## 5. Páginas sugeridas

**Página 1: Visão geral (para decidir onde a cidade está mais exposta)**
- Segmentações: `dim_estacao[bairro]`, `dim_calendario[data]` (entre), `dim_calendario[mes_nome]`
- Cartões: `Enchentes`, `Antecedência IA (min)`, `Ganho de Antecedência (min)`, `Horas Acima do Transbordo`, `Pessoas Expostas`
- Gráfico de colunas e linhas: eixo `dim_calendario[data]`, colunas `Chuva Média por Estação (mm)`, linha `Nível Máx. % da Cota`
- Barras agrupadas: `Antecedência IA (min)` × `Antecedência Régua (min)` por `bairro`

**Página 2: Onde agir primeiro**
- Matriz: `bairro`, `Enchentes`, `Horas Acima do Transbordo`, `Ranking de Risco`, `Prioridade` (cor de fundo pela medida `Cor Prioridade`)
- Mapa: latitude `dim_estacao[lat]`, longitude `dim_estacao[lon]`, tamanho `Horas Acima do Transbordo`
- Linha: `Enchentes Acumuladas` por data

**Página 3: Qualidade do dado (manutenção dos sensores)**
- Cartões: `Completude Média (%)`, `Taxa de Quarentena`, `Horas sem Sinal`
- Colunas empilhadas por `bairro`: `recebidas`, `quarentena`, `imputadas`

## 6. Evidência para o PDF

Tire um print de cada página com um filtro aplicado (por exemplo, bairro = Pirajuçara) e
salve em `docs/evidencias/powerbi_*.png`.
