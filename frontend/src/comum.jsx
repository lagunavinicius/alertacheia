import { useEffect, useRef, useState } from "react";
import { WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { obter } from "./api.js";
import { cn } from "@/lib/utils";

export const RISCO = {
  NORMAL: { rotulo: "Normal", frase: "Sem risco de enchente agora", classe: "normal", ordem: 0 },
  ATENCAO: { rotulo: "Atenção", frase: "Chuva forte: fique atento", classe: "atencao", ordem: 1 },
  ALERTA: { rotulo: "Alerta", frase: "Risco alto de enchente nas próximas 2 horas", classe: "alerta", ordem: 2 },
  EMERGENCIA: { rotulo: "Emergência", frase: "O córrego transbordou: saia agora", classe: "emergencia", ordem: 3 },
};

export const SEM_DADO = "sem dado";

export function riscoDe(estacao) {
  return estacao?.ultima_leitura?.risco || "NORMAL";
}

export const classeRisco = (risco) => `risco-${(RISCO[risco] || RISCO.NORMAL).classe}`;

/** Busca periódica: o painel e o "meu bairro" se atualizam sozinhos. */
export function useDados(caminho, { intervalo = 0, autenticado = false } = {}) {
  const [estado, setEstado] = useState({ dados: null, erro: null, offline: false, carregando: true });
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    if (!caminho) return undefined;
    const buscar = () =>
      obter(caminho, { autenticado })
        .then((r) => vivo.current && setEstado({ ...r, erro: null, carregando: false }))
        .catch((erro) => vivo.current && setEstado((s) => ({ ...s, erro, carregando: false })));
    buscar();
    const id = intervalo ? setInterval(buscar, intervalo) : null;
    return () => {
      vivo.current = false;
      if (id) clearInterval(id);
    };
  }, [caminho, intervalo, autenticado]);

  return estado;
}

/** Selo de status: a única cor saturada na tela é a do risco. */
export function SeloRisco({ risco, grande = false, className }) {
  const r = RISCO[risco] || RISCO.NORMAL;
  return (
    <span
      className={cn(
        classeRisco(risco),
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-risco-fundo font-semibold text-risco",
        grande ? "px-4 py-1.5 text-base" : "px-3 py-0.5 text-sm",
        className
      )}
    >
      <span className={cn("size-2 rounded-full bg-risco", risco === "EMERGENCIA" && "motion-safe:animate-pulse")} aria-hidden="true" />
      {r.rotulo}
    </span>
  );
}

/** Régua horizontal: a água até o nível, com a cota de alerta e a de transbordo marcadas. */
export function BarraNivel({ nivel, alerta, transbordo, className }) {
  const max = transbordo * 1.25;
  const pct = Math.min(100, (nivel / max) * 100);
  const classe = nivel >= transbordo ? "emergencia" : nivel >= alerta ? "atencao" : "normal";
  return (
    <div
      className={cn("relative h-3 rounded-full bg-superficie-3", className)}
      role="img"
      aria-label={`Nível ${Math.round(nivel)} cm de ${transbordo} cm do limite`}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-700 ease-out",
          classe === "normal" ? "bg-rio" : `risco-${classe} bg-risco`
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
      <span className="absolute -inset-y-1 w-0.5 bg-atencao" style={{ left: `${(alerta / max) * 100}%` }} title="cota de alerta" />
      <span className="absolute -inset-y-1.5 w-[3px] rounded bg-linha" style={{ left: `${(transbordo / max) * 100}%` }} title="cota de transbordo" />
    </div>
  );
}

/** Tubo vertical: o córrego em miniatura, para listas e para o mapa. */
export function Tubo({ pct = 0, risco = "NORMAL", className }) {
  const altura = Math.min(Math.max(pct, 0), 1.25) / 1.25;
  return (
    <span className={cn("relative block h-10 w-4 shrink-0 overflow-hidden rounded-full bg-superficie-3", classeRisco(risco), className)} aria-hidden="true">
      <span
        className={cn("absolute inset-x-0 bottom-0 h-full origin-bottom transition-transform duration-700", risco === "NORMAL" ? "bg-rio" : "bg-risco")}
        style={{ transform: `scaleY(${altura})` }}
      />
      <span className="absolute inset-x-0 h-0.5 bg-linha" style={{ bottom: `${(1 / 1.25) * 100}%` }} />
    </span>
  );
}

export function AvisoOffline({ offline, guardadoEm }) {
  if (!offline) return null;
  const hora = new Date(guardadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="risco-atencao flex items-start gap-3 rounded-md bg-risco-fundo px-4 py-3 font-semibold text-risco" role="status">
      <WifiSlash size={22} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Sem conexão. Mostrando a última informação recebida, das {hora}. Em perigo, ligue{" "}
        <a href="tel:199" className="underline"><strong>199</strong></a>.
      </span>
    </div>
  );
}

export function horaCurta(iso) {
  if (!iso) return SEM_DADO;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Esqueleto no formato do conteúdo final: a tela não "pula" quando os dados chegam. */
export function Carregando({ texto = "Carregando as informações do seu bairro" }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-5 py-8" role="status" aria-live="polite">
      <span className="sr">{texto}</span>
      <div className="esqueleto h-9 w-1/2" />
      <div className="esqueleto h-72 rounded-2xl" />
      <div className="esqueleto h-5 w-4/5" />
      <div className="esqueleto h-5 w-2/5" />
    </div>
  );
}

export function Erro({ erro }) {
  if (!erro) return null;
  const semRede = !erro.status;
  return (
    <div className="risco-emergencia flex items-start gap-3 rounded-md bg-risco-fundo px-4 py-3 font-semibold text-risco" role="alert">
      <WarningCircle size={22} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="m-0">
        {semRede ? "Não foi possível falar com o servidor. Confira a internet e tente de novo em instantes." : erro.message}
      </p>
    </div>
  );
}

/** Cabeçalho de página: título forte, subtítulo curto, sem eyebrow. */
export function Cabecalho({ titulo, children, acao }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="m-0 text-3xl font-bold md:text-5xl">{titulo}</h1>
        {children && <p className="mt-3 text-lg text-texto-2">{children}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Pagina({ className, children, larga = false }) {
  return (
    <div className={cn("mx-auto grid w-full grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-8 pb-14 md:px-8", larga ? "max-w-7xl" : "max-w-5xl", className)}>
      {children}
    </div>
  );
}
