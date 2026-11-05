import { useState } from "react";
import { Link } from "react-router-dom";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowRight, CaretDown, Drop, CloudRain, Plant, SpeakerHigh } from "@phosphor-icons/react";
import { AvisoOffline, Carregando, Erro, RISCO, SeloRisco, classeRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A tela inteira é o córrego: a água sobe na proporção do nível medido e a linha
// tracejada é a cota de transbordo (a "linha de alerta" da marca).
// 125% da cota enche 82% da tela; a cota fica em 66%.
const TETO = 1.25;
const ALTURA_MAX = 0.82;
const fracaoAgua = (pct) => (Math.min(Math.max(pct || 0, 0), TETO) / TETO) * ALTURA_MAX;

const ORIENTACAO_NORMAL = [
  "Guarde documentos e remédios em saco plástico, num lugar alto.",
  "Salve o número da Defesa Civil: 199.",
  "Cadastre seu telefone para receber o aviso antes da água chegar.",
];

function ouvir(texto) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.95;
  window.speechSynthesis.speak(fala);
}

function Agua({ pct }) {
  const reduzir = useReducedMotion();
  const fracao = fracaoAgua(pct);
  return (
    <div className="tela-agua-fundo" aria-hidden="true">
      <m.div
        className="absolute inset-x-0 bottom-0 h-full"
        initial={reduzir ? false : { y: "100%" }}
        animate={{ y: `${(1 - fracao) * 100}%` }}
        transition={{ type: "spring", stiffness: 40, damping: 18, mass: 1.2 }}
      >
        <div className="agua-corpo" />
        <svg className="agua-onda" viewBox="0 0 2400 26" preserveAspectRatio="none">
          {/* duas ondas idênticas lado a lado: a deriva em loop não tem emenda */}
          <path d="M0 13 C150 0 450 0 600 13 S1050 26 1200 13 S1650 0 1800 13 S2250 26 2400 13 V26 H0 Z" />
        </svg>
      </m.div>
      <div className="linha-limite" style={{ bottom: `${(1 / TETO) * ALTURA_MAX * 100}%` }}>
        <span className="absolute right-4 bottom-1.5 text-sm font-semibold text-linha max-md:hidden">limite do córrego</span>
      </div>
    </div>
  );
}

function SeletorBairro({ estacoes, valor, onChange }) {
  return (
    <label className="relative inline-flex max-w-full items-center">
      <span className="sr">Seu bairro</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 max-w-full appearance-none truncate rounded-full border border-borda-forte bg-superficie/70 py-2 pr-11 pl-5 text-base font-semibold text-texto backdrop-blur hover:border-texto-2"
      >
        {estacoes.map((e) => (
          <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}, {e.corpo_dagua}</option>
        ))}
      </select>
      <CaretDown size={18} weight="bold" className="pointer-events-none absolute right-4 text-texto-2" aria-hidden="true" />
    </label>
  );
}

function Dado({ Icone, rotulo, valor }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-superficie px-4 py-3">
      <Icone size={24} className="shrink-0 text-rio" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm text-texto-3">{rotulo}</div>
        <div className="text-lg font-semibold">{valor}</div>
      </div>
    </div>
  );
}

export default function MeuBairro() {
  const { dados: estacoes, erro, offline, guardadoEm, carregando } = useDados("/api/estacoes", { intervalo: 4000 });
  const [escolhida, setEscolhida] = useState(() => localStorage.getItem("ac:estacao") || "EST-03");

  if (carregando && !estacoes) return <Carregando />;
  if (!estacoes) return <div className="mx-auto max-w-5xl p-5"><Erro erro={erro} /></div>;

  const est = estacoes.find((e) => e.estacao_id === escolhida) || estacoes[0];
  const risco = riscoDe(est);
  const r = RISCO[risco];
  const alerta = est.alerta_ativo;
  const ult = est.ultima_leitura;
  const chance = Math.round((ult?.prob_transbordo || 0) * 100);
  const pctLimite = Math.round((ult?.pct_transbordo || 0) * 100);

  const trocar = (id) => {
    setEscolhida(id);
    localStorage.setItem("ac:estacao", id);
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        className={cn(
          "tela-agua flex min-h-[calc(100dvh-64px-var(--barra-inferior,0px))] flex-col",
          classeRisco(risco),
          "bg-[radial-gradient(120%_70%_at_0%_0%,var(--risco-fundo),transparent_60%)]"
        )}
        aria-labelledby="titulo-risco"
      >
        <Agua pct={ult?.pct_transbordo} />

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 pt-6 pb-8 md:px-8 md:pt-10">
          <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
          <div className="flex flex-wrap items-center gap-3">
            <SeletorBairro estacoes={estacoes} valor={est.estacao_id} onChange={trocar} />
            <span className="text-sm text-texto-3">atualizado {horaCurta(ult?.ts)}</span>
          </div>

          {/* só o essencial é "ao vivo": o leitor de tela anuncia quando o risco muda, não a cada leitura */}
          <div aria-live="polite" aria-atomic="true" className="halo-texto grid max-w-3xl gap-4">
            <SeloRisco risco={risco} grande className="justify-self-start" />
            <h1 id="titulo-risco" className="m-0 text-4xl leading-[1.05] font-bold md:text-6xl">
              {alerta ? alerta.titulo : r.frase}
            </h1>
            <p className="m-0 max-w-[60ch] text-lg text-texto-2 md:text-xl">
              {alerta
                ? alerta.mensagem
                : `O ${est.corpo_dagua} está em ${pctLimite}% do limite. Não há previsão de transbordo nas próximas 2 horas.`}
            </p>
          </div>
          {alerta && (
            <Button variant="claro" className="self-start" onClick={() => ouvir(alerta.texto_audio)}>
              <SpeakerHigh size={22} weight="bold" aria-hidden="true" /> Ouvir o alerta
            </Button>
          )}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-6 pt-10">
            <div>
              <div className="numero text-[5.5rem] md:text-[8rem]" aria-hidden="true">{chance}%</div>
              <p className="m-0 mt-1 text-lg font-semibold">chance de transbordar nas próximas 2 horas</p>
              <p className="sr">Chance de transbordar nas próximas 2 horas: {chance}%.</p>
              <p className="m-0 text-texto-2">o córrego está em {pctLimite}% do limite</p>
            </div>
            <Link
              to={`/estacoes/${est.estacao_id}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-borda-forte bg-superficie/70 px-5 font-semibold no-underline backdrop-blur hover:border-texto-2"
            >
              Ver as últimas 24 horas <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-5 py-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:px-8">
        <section aria-labelledby="titulo-acoes">
          <h2 id="titulo-acoes" className="m-0 mb-5 text-2xl font-bold">{alerta ? "O que fazer agora" : "Enquanto não chove"}</h2>
          <ol className="m-0 grid list-none gap-3 p-0">
            {(alerta ? alerta.acoes : ORIENTACAO_NORMAL).map((acao, i) => (
              <li key={acao} className="flex items-start gap-4 rounded-md bg-superficie px-4 py-4">
                <span className="numero grid size-10 shrink-0 place-items-center rounded-full bg-linha-suave text-2xl text-linha" aria-hidden="true">{i + 1}</span>
                <span className="pt-1.5 text-lg">{acao}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 mb-0 text-texto-2">
            Abrigo mais próximo: <strong className="text-texto">{est.abrigo}</strong>
          </p>
        </section>

        <section aria-labelledby="titulo-agora" className="grid content-start gap-3">
          <h2 id="titulo-agora" className="m-0 mb-2 text-2xl font-bold">O córrego agora</h2>
          <Dado Icone={Drop} rotulo="Nível da água" valor={ult ? `${Math.round(ult.nivel_cm)} cm de ${est.cota_transbordo_cm} cm` : "sem dado"} />
          <Dado Icone={CloudRain} rotulo="Chuva na última hora" valor={ult ? `${ult.chuva_1h_mm} mm` : "sem dado"} />
          <Dado
            Icone={Plant}
            rotulo="Solo"
            valor={!ult ? "sem dado" : ult.umidade_solo_pct >= 75 ? "encharcado, não absorve mais" : ult.umidade_solo_pct >= 55 ? "úmido" : "seco"}
          />
          <div className="mt-3 rounded-lg border border-linha/40 bg-linha-suave p-5">
            <h3 className="m-0 text-lg font-bold">Receba o aviso no celular</h3>
            <p className="mt-1 mb-4 text-texto-2">O SMS chega em média uma hora antes da água: tempo para tirar a família e os documentos de casa.</p>
            <Button variant="alerta" asChild>
              <Link to="/cadastro" className="no-underline">Quero receber</Link>
            </Button>
          </div>
        </section>
      </div>
    </LazyMotion>
  );
}
