/*
 * AlertaCheia - Estacao de monitoramento de corrego (TinkerCad, Arduino Uno R3)
 * ----------------------------------------------------------------------------
 * Estacao EST-03, instalada na ponte do Corrego Aricanduva (Vila Aricanduva).
 *
 * A cada ciclo a estacao:
 *   1. LE o nivel da agua, a chuva e a umidade do solo;
 *   2. DECIDE localmente (edge) o status: OK, ATENCAO ou TRANSBORDO;
 *   3. ATUA nos LEDs e na sirene. A sirene local toca mesmo sem internet:
 *      e o plano B do bairro quando a rede cai no meio do temporal;
 *   4. PUBLICA uma linha CSV no Monitor Serial. O script iot/serial_para_api.py
 *      envia essas linhas para a API, que roda o modelo de IA e alimenta o
 *      Data Lake (bronze/tempo_real).
 *
 * Sensores (pinagem completa em iot/GUIA_TINKERCAD.md):
 *   D6/D7  HC-SR04 ultrassonico ........ distancia ate a lamina d'agua (cm)
 *          instalado a ALTURA_SENSOR_CM do fundo: nivel = altura - distancia
 *   A0     Sensor de umidade do solo .... encharcamento do solo (%)  [VCC no D8]
 *   A1     Potenciometro 10 kohm ........ pluviometro (mm por 15 min)
 *          (o TinkerCad nao tem pluviometro; o potenciometro faz o papel dele)
 * Atuadores:
 *   D11 LED verde (OK) · D12 LED amarelo (ATENCAO) · D13 LED vermelho (TRANSBORDO)
 *   D9  Buzzer piezo (sirene)
 *
 * Tempo acelerado: cada ciclo de 1 s representa 15 min (uma leitura real).
 * O Arduino nao tem relogio; o script de envio converte "seq" em horario.
 *
 * As cotas sao as mesmas de alertacheia/config.py (EST-03): a decisao na
 * borda e a decisao da nuvem falam a mesma lingua.
 *
 * Compatibilidade com o TinkerCad: sem LCD I2C e todo em ASCII (o compilador
 * do TinkerCad recusa algumas bibliotecas e caracteres acentuados).
 */

const char ESTACAO[] = "EST-03";

// Pinos
const int PINO_TRIG = 6;
const int PINO_ECHO = 7;
const int PINO_SOLO_VCC = 8;
const int PINO_SOLO = A0;
const int PINO_CHUVA = A1;
const int LED_VERDE = 11;
const int LED_AMARELO = 12;
const int LED_VERMELHO = 13;
const int BUZZER = 9;

// Calibracao (EST-03, Corrego Aricanduva)
const float ALTURA_SENSOR_CM = 330.0;   // do fundo do corrego ate o sensor
const float COTA_ALERTA_CM = 170.0;
const float COTA_TRANSBORDO_CM = 215.0;
const float CHUVA_MAX_MM = 40.0;        // fundo de escala do potenciometro
const int SOLO_LEITURA_MAX = 876;       // leitura maxima do sensor no TinkerCad

const unsigned long CICLO_MS = 1000;
unsigned long seq = 0;

float medirDistanciaCm() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);
  unsigned long duracao = pulseIn(PINO_ECHO, HIGH, 30000UL);  // timeout ~5 m
  if (duracao == 0) {
    return -1.0;  // sem eco: leitura invalida (a API recusa e a silver poe em quarentena)
  }
  return duracao * 0.0343 / 2.0;
}

float lerUmidadeSolo() {
  digitalWrite(PINO_SOLO_VCC, HIGH);  // liga so na hora de ler: reduz corrosao do sensor
  delay(10);
  int bruto = analogRead(PINO_SOLO);
  digitalWrite(PINO_SOLO_VCC, LOW);
  float pct = bruto * 100.0 / SOLO_LEITURA_MAX;
  if (pct > 100.0) pct = 100.0;
  return pct;
}

float lerChuvaMm() {
  return analogRead(PINO_CHUVA) * CHUVA_MAX_MM / 1023.0;
}

void acenderStatus(int verde, int amarelo, int vermelho) {
  digitalWrite(LED_VERDE, verde);
  digitalWrite(LED_AMARELO, amarelo);
  digitalWrite(LED_VERMELHO, vermelho);
}

void setup() {
  Serial.begin(9600);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_ECHO, INPUT);
  pinMode(PINO_SOLO_VCC, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  // cabecalho do CSV (o script de envio ignora linhas que nao comecam com EST-)
  Serial.println("estacao_id,seq,nivel_cm,chuva_mm,umidade_solo_pct,status_local");
}

void loop() {
  float distancia = medirDistanciaCm();
  float nivel = (distancia < 0) ? -1.0 : ALTURA_SENSOR_CM - distancia;
  if (nivel < 0 && distancia >= 0) nivel = 0.0;
  float chuva = lerChuvaMm();
  float solo = lerUmidadeSolo();

  // Decisao na borda: a mais conservadora possivel, sem depender da nuvem.
  const char* status;
  if (nivel < 0) {
    status = "SEM_ECO";  // falha do sensor: mantem os LEDs como estavam e avisa a nuvem
  } else if (nivel >= COTA_TRANSBORDO_CM) {
    status = "TRANSBORDO";
    acenderStatus(LOW, LOW, HIGH);
    tone(BUZZER, (seq % 2 == 0) ? 880 : 660, 600);  // sirene de duas notas
  } else if (nivel >= COTA_ALERTA_CM || (chuva >= 12.0 && solo >= 80.0)) {
    status = "ATENCAO";
    acenderStatus(LOW, HIGH, LOW);
    noTone(BUZZER);
  } else {
    status = "OK";
    acenderStatus(HIGH, LOW, LOW);
    noTone(BUZZER);
  }

  Serial.print(ESTACAO);
  Serial.print(",");
  Serial.print(seq);
  Serial.print(",");
  Serial.print(nivel, 1);
  Serial.print(",");
  Serial.print(chuva, 1);
  Serial.print(",");
  Serial.print(solo, 1);
  Serial.print(",");
  Serial.println(status);

  seq++;
  delay(CICLO_MS);
}
