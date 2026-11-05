# Estação IoT no TinkerCad: montagem e uso

Estação **EST-03 · Córrego Aricanduva**. São 3 sensores e 4 atuadores, num Arduino Uno R3.

## Componentes (painel "Componentes" do TinkerCad, filtro "Todos")

| Qtd | Componente no TinkerCad | Papel na estação |
|---|---|---|
| 1 | Arduino Uno R3 | controlador |
| 1 | Sensor de distância ultrassônico (HC-SR04, 4 pinos) | nível da água |
| 1 | Sensor de umidade do solo | encharcamento do solo |
| 1 | Potenciômetro 10 kΩ | pluviômetro (o TinkerCad não tem um) |
| 3 | LED (verde, amarelo, vermelho) + 3 resistores de 220 Ω | status local |
| 1 | Piezo (buzzer) | sirene do bairro |
| 1 | Placa de ensaio (protoboard) | montagem |

## Ligações

| Componente | Pino do componente | Arduino |
|---|---|---|
| HC-SR04 | VCC / GND | 5V / GND |
| HC-SR04 | TRIG | D6 |
| HC-SR04 | ECHO | D7 |
| Umidade do solo | VCC | **D8** (liga só na hora da leitura) |
| Umidade do solo | GND / SIG | GND / A0 |
| Potenciômetro | extremos | 5V e GND |
| Potenciômetro | cursor (meio) | A1 |
| LED verde (ânodo, via 220 Ω) | + | D11 |
| LED amarelo (ânodo, via 220 Ω) | + | D12 |
| LED vermelho (ânodo, via 220 Ω) | + | D13 |
| Piezo | + / − | D9 / GND |

## Passo a passo

1. Monte o circuito, abra **Código → Texto** e cole `iot/estacao_cheia/estacao_cheia.ino`.
2. Clique em **Iniciar simulação** e abra o **Monitor serial**.
3. Para simular a cheia, clique no HC-SR04 e **aproxime a bolinha do sensor**. A distância cai e o nível sobe, porque nível = 330 cm − distância. Para simular chuva, gire o potenciômetro. Para encharcar o solo, mexa no controle do sensor de umidade.
4. Observe a **decisão na borda**:
   - verde = OK;
   - amarelo = ATENÇÃO (nível ≥ 170 cm, ou chuva forte com solo encharcado);
   - vermelho com sirene = TRANSBORDO (nível ≥ 215 cm).

   A sirene funciona mesmo sem internet.
5. Copie o texto do Monitor Serial para um arquivo `.txt` e envie para a API, com ela no ar:

```bash
python -m iot.serial_para_api caminho/do/monitor_serial.txt
```

Sem o TinkerCad aberto, use a captura de exemplo que acompanha o projeto:

```bash
python -m iot.serial_para_api iot/exemplo_serial_tinkercad.txt
```

## O que acontece com cada linha

```
EST-03,8,222.6,13.9,99.8,TRANSBORDO
   │   │   │     │    │      └ decisão local (borda)
   │   │   │     │    └ umidade do solo (%)
   │   │   │     └ chuva no ciclo (mm / 15 min)
   │   │   └ nível (cm)
   │   └ sequência (o script transforma em horário, de 15 em 15 min)
   └ estação
```

1. O script envia a leitura para `POST /api/leituras` com a chave da EST-03 no cabeçalho `X-API-Key`.
2. A API valida a leitura. A linha `seq=9` do exemplo tem `-1.0` (sensor sem eco) e é **recusada com 422**: dado ruim não chega ao modelo.
3. A leitura entra no Data Lake (`datalake/bronze/tempo_real/`) e passa pelo modelo de IA.
4. A decisão da nuvem (pré-alerta, alerta ou emergência) aparece no terminal, ao lado da decisão da borda. A nuvem costuma avisar **antes** da borda, porque enxerga a tendência e a chuva acumulada, e não só o nível do momento.

## Sem TinkerCad: sensores mock

`python -m iot.simulador --tempestade EST-03` simula as 5 estações publicando ao mesmo tempo, com a mesma física do histórico.
