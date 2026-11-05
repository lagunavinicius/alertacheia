import { useState } from "react";
import { CaretDown, ChatText } from "@phosphor-icons/react";
import { AvisoOffline, Cabecalho, Carregando, Erro, Pagina, SeloRisco, classeRisco, horaCurta, useDados } from "../comum.jsx";
import { Selecao } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Alertas() {
  const [filtro, setFiltro] = useState("");
  const { dados: estacoes } = useDados("/api/estacoes");
  const caminho = `/api/alertas?limite=50${filtro ? `&estacao_id=${filtro}` : ""}`;
  const { dados, erro, offline, guardadoEm, carregando } = useDados(caminho, { intervalo: 5000 });

  return (
    <Pagina>
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <Cabecalho titulo="Alertas emitidos">Os mesmos avisos que chegam por SMS aos moradores cadastrados.</Cabecalho>

      <Selecao
        variante="pilula"
        aria-label="Filtrar por bairro"
        className="justify-self-start"
        value={filtro}
        onChange={setFiltro}
        opcoes={[{ valor: "", rotulo: "Todos os bairros" }, ...(estacoes || []).map((e) => ({ valor: e.estacao_id, rotulo: e.bairro }))]}
      />

      {carregando && !dados && <Carregando texto="Carregando os alertas" />}
      {!dados && <Erro erro={erro} />}
      {dados && dados.length === 0 && (
        <div className="rounded-lg border border-borda bg-superficie p-8 text-center">
          <p className="m-0 text-xl font-semibold">Nenhum alerta emitido</p>
          <p className="mt-1 mb-0 text-texto-2">Quando um córrego estiver perto de transbordar, o aviso aparece aqui e chega por SMS.</p>
        </div>
      )}

      {/* linha do tempo: a linha vertical é o córrego, cada alerta é uma marca nele */}
      <ol className="relative m-0 grid list-none gap-4 p-0 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-borda-forte">
        {(dados || []).map((a) => (
          <li key={a.id} className={cn("relative pl-10", classeRisco(a.risco), a.status === "encerrado" && "opacity-70")}>
            <span className="absolute top-5 left-0 size-6 rounded-full border-4 border-noite bg-risco" aria-hidden="true" />
            <article className="rounded-lg border border-borda bg-superficie p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm text-texto-3">
                <SeloRisco risco={a.risco} />
                <span>{a.bairro}, {horaCurta(a.criado_em)}</span>
                {a.status === "encerrado" && <span className="rounded-full border border-borda px-2.5 py-0.5">encerrado</span>}
              </div>
              <h2 className="mt-3 mb-1 text-2xl font-bold">{a.titulo}</h2>
              <p className="m-0 text-lg text-texto-2">{a.mensagem}</p>
              <details className="group mt-4">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold">
                  <ChatText size={20} aria-hidden="true" /> Ver o SMS enviado
                  <CaretDown size={16} weight="bold" className="transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 mb-1 rounded-md bg-superficie-2 px-4 py-3 font-mono text-sm">{a.sms}</p>
                <p className="m-0 text-sm text-texto-3">Texto gerado por: {a.gerado_por}</p>
              </details>
            </article>
          </li>
        ))}
      </ol>
    </Pagina>
  );
}
