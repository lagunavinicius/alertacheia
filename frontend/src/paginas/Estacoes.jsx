import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CaretRight, HouseLine } from "@phosphor-icons/react";
import { AvisoDefasado, AvisoOffline, BarraNivel, atrasadas, maisAntiga, br, Carregando, Erro, RISCO, SeloRisco, Tubo, horaCurta, riscoDe, useDados } from "../comum.jsx";
import MapaEstacoes from "../components/MapaEstacoes.jsx";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function DetalheRapido({ estacao }) {
  const u = estacao.ultima_leitura;
  const definirComoMeu = () => localStorage.setItem("ac:estacao", estacao.estacao_id);
  return (
    <div className="grid gap-5">
      <SeloRisco risco={riscoDe(estacao)} grande className="justify-self-start" />
      {u && (
        <>
          <div>
            <div className="numero text-7xl">{Math.round((u.prob_transbordo || 0) * 100)}%</div>
            <p className="m-0 font-semibold">chance de transbordar nas próximas 2 horas</p>
          </div>
          <div className="grid gap-2">
            <span className="text-sm text-texto-2">Nível agora: {Math.round(u.nivel_cm)} cm</span>
            <BarraNivel nivel={u.nivel_cm} alerta={estacao.cota_alerta_cm} transbordo={estacao.cota_transbordo_cm} />
          </div>
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-superficie-2 p-3"><dt className="text-sm text-texto-3">Chuva em 1 h</dt><dd className="m-0 text-lg font-semibold">{br(u.chuva_1h_mm)} mm</dd></div>
            <div className="rounded-md bg-superficie-2 p-3"><dt className="text-sm text-texto-3">Última leitura</dt><dd className="m-0 text-lg font-semibold">{horaCurta(u.ts)}</dd></div>
          </dl>
        </>
      )}
      <p className="m-0 text-texto-2">Abrigo: <strong className="text-texto">{estacao.abrigo}</strong></p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/estacoes/${estacao.estacao_id}`} className="no-underline">Ver 24 horas <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link>
        </Button>
        <Button variant="contorno" asChild onClick={definirComoMeu}>
          <Link to="/" className="no-underline"><HouseLine size={18} weight="bold" aria-hidden="true" /> É o meu bairro</Link>
        </Button>
      </div>
    </div>
  );
}

export default function Estacoes() {
  const { dados, erro, offline, guardadoEm, carregando } = useDados("/api/estacoes", { intervalo: 4000 });
  const [aberta, setAberta] = useState(null);
  // o Sheet abre por estado (sem Trigger): guardamos quem abriu para devolver o foco ao fechar
  const origem = useRef(null);
  const abrir = (id) => {
    origem.current = document.activeElement;
    setAberta(id);
  };
  if (carregando && !dados) return <Carregando texto="Carregando o mapa das estações" />;
  if (!dados) return <div className="mx-auto max-w-5xl p-5"><Erro erro={erro} /></div>;

  const ordenadas = [...dados].sort((a, b) => RISCO[riscoDe(b)].ordem - RISCO[riscoDe(a)].ordem
    || (b.ultima_leitura?.pct_transbordo || 0) - (a.ultima_leitura?.pct_transbordo || 0));
  const selecionada = dados.find((e) => e.estacao_id === aberta);

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-8 pb-14 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="lg:col-span-2">
        <div className="grid gap-3 empty:hidden">
          <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
          <AvisoDefasado ts={maisAntiga(dados)} onde={atrasadas(dados)} />
        </div>
        <h1 className="mt-3 mb-0 text-3xl font-bold md:text-5xl">Os córregos agora</h1>
        <p className="mt-3 mb-0 max-w-2xl text-lg text-texto-2">
          Cinco estações medem a água, a chuva e o solo a cada 15 minutos. Toque numa estação para ver o risco.
        </p>
      </div>

      <MapaEstacoes estacoes={dados} selecionada={aberta} onSelecionar={abrir} altura="h-[58dvh] lg:h-[calc(100dvh-220px)]" />

      <section aria-labelledby="titulo-lista" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2">
        <h2 id="titulo-lista" className="m-0 mb-2 text-xl font-bold">Do maior para o menor risco</h2>
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0">
          {ordenadas.map((e) => {
            const u = e.ultima_leitura;
            return (
              <li key={e.estacao_id}>
                <button
                  type="button"
                  onClick={() => abrir(e.estacao_id)}
                  className="flex w-full items-center gap-4 rounded-md border border-borda bg-superficie px-4 py-3 text-left transition-colors hover:border-borda-forte"
                >
                  <Tubo pct={u?.pct_transbordo} risco={riscoDe(e)} />
                  {/* o nome do bairro nunca é cortado: quebra linha, e o risco vem logo abaixo */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-tight font-semibold">{e.bairro}</span>
                    <span className="block text-sm text-texto-3">{e.corpo_dagua}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SeloRisco risco={riscoDe(e)} />
                      <span className="text-sm text-texto-2">{Math.round((u?.pct_transbordo || 0) * 100)}% do limite</span>
                    </span>
                  </span>
                  <CaretRight size={18} className="shrink-0 text-texto-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={!!selecionada} onOpenChange={(v) => !v && setAberta(null)}>
        {selecionada && (
          <SheetContent
            onCloseAutoFocus={(ev) => { ev.preventDefault(); origem.current?.focus?.(); }}
            titulo={selecionada.bairro} descricao={`${selecionada.corpo_dagua}, ${selecionada.regiao}`}>
            <DetalheRapido estacao={selecionada} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
