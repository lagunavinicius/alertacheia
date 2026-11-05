import { useEffect, useRef, useState } from "react";
import { WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { obter } from "./api.js";

export const RISCO = {
  NORMAL: { rotulo: "Normal", frase: "Sem risco de enchente agora", classe: "normal" },
  ATENCAO: { rotulo: "Atenção", frase: "Chuva forte: fique atento", classe: "atencao" },
  ALERTA: { rotulo: "Alerta", frase: "Risco alto de enchente nas próximas 2 horas", classe: "alerta" },
  EMERGENCIA: { rotulo: "Emergência", frase: "O córrego transbordou: saia agora", classe: "emergencia" },
};

export function riscoDe(estacao) {
  return estacao?.ultima_leitura?.risco || "NORMAL";
}

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

export function SeloRisco({ risco, grande = false }) {
  const r = RISCO[risco] || RISCO.NORMAL;
  return (
    <span className={`selo selo-${r.classe} ${grande ? "selo-grande" : ""}`}>
      <span className="selo-ponto" aria-hidden="true" />
      {r.rotulo}
    </span>
  );
}

export function BarraNivel({ nivel, alerta, transbordo }) {
  const max = transbordo * 1.25;
  const pct = Math.min(100, (nivel / max) * 100);
  const pAlerta = (alerta / max) * 100;
  const pTransb = (transbordo / max) * 100;
  const classe = nivel >= transbordo ? "emergencia" : nivel >= alerta ? "atencao" : "normal";
  return (
    <div className="barra-nivel" role="img" aria-label={`Nível ${Math.round(nivel)} cm de ${transbordo} cm do limite`}>
      {/* escala em transform (não em width): anima sem recalcular o layout */}
      <div className={`barra-agua barra-${classe}`} style={{ transform: `scaleX(${pct / 100})` }} />
      <span className="barra-marca" style={{ left: `${pAlerta}%` }} title="cota de alerta" />
      <span className="barra-marca barra-marca-forte" style={{ left: `${pTransb}%` }} title="cota de transbordo" />
    </div>
  );
}

export function AvisoOffline({ offline, guardadoEm }) {
  if (!offline) return null;
  const hora = new Date(guardadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="aviso-offline" role="status">
      <WifiSlash size={22} weight="bold" aria-hidden="true" />
      <span>
        Sem conexão. Mostrando a última informação recebida, das {hora}. Em perigo, ligue{" "}
        <a href="tel:199"><strong>199</strong></a>.
      </span>
    </div>
  );
}

export const SEM_DADO = "sem dado";

export function horaCurta(iso) {
  if (!iso) return SEM_DADO;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Esqueleto no formato do conteúdo final: a tela não "pula" quando os dados chegam. */
export function Carregando({ texto = "Carregando as informações do seu bairro" }) {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="sr">{texto}</span>
      <div className="esqueleto esqueleto-titulo" />
      <div className="esqueleto esqueleto-bloco" />
      <div className="esqueleto esqueleto-linha" />
      <div className="esqueleto esqueleto-linha curta" />
    </div>
  );
}

export function Erro({ erro }) {
  if (!erro) return null;
  const semRede = !erro.status;
  return (
    <div className="erro-bloco" role="alert">
      <WarningCircle size={22} weight="bold" aria-hidden="true" />
      <p>
        {semRede
          ? "Não foi possível falar com o servidor. Confira a internet e tente de novo em instantes."
          : erro.message}
      </p>
    </div>
  );
}
