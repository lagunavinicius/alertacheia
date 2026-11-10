import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { CaretDown, CheckCircle, CloudRain, SignOut } from "@phosphor-icons/react";
import { enviar, salvarToken, tokenAtual } from "../api.js";
import { AvisoDefasado, Carregando, Erro, SEM_DADO, br, atrasadas, defasado, maisAntiga, SeloRisco, Tubo, classeRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";
import MapaEstacoes from "../components/MapaEstacoes.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardTitulo } from "@/components/ui/card";
import { Selecao } from "@/components/ui/select";
import { Tabs, TabsConteudo, TabsGatilho, TabsLista } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const css = (v) => `var(${v})`;
const frase = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function Seletor({ rotulo, className, value, onChange, opcoes }) {
  const id = useId();
  return (
    <div className={cn("grid gap-1 text-sm text-texto-2", className)}>
      <label htmlFor={id}>{rotulo}</label>
      <Selecao id={id} variante="compacto" className="text-base" value={value} onChange={onChange} opcoes={opcoes} />
    </div>
  );
}

function Indicador({ rotulo, valor, unidade, detalhe, destaque }) {
  return (
    <div className={cn("grid content-start gap-1 rounded-lg bg-superficie-2 p-4 md:p-5", destaque && "bg-linha-suave ring-1 ring-linha")}>
      <span className="text-sm text-texto-2">{rotulo}</span>
      <span className={cn("numero text-4xl md:text-5xl", destaque && "text-linha")}>
        {br(valor) ?? SEM_DADO}
        {valor != null && unidade && <small className="ml-1 text-lg font-semibold text-texto-2">{unidade}</small>}
      </span>
      {detalhe && <span className="text-sm text-texto-3">{detalhe}</span>}
    </div>
  );
}

/** Mapa ao vivo + faixa de estações + simulador de chuva para treinar a equipe. */
function AoVivo({ aoSimular }) {
  const { dados } = useDados("/api/estacoes", { intervalo: 3000 });
  const [estacao, setEstacao] = useState("EST-03");
  const [cenario, setCenario] = useState("tempestade");
  const [simulando, setSimulando] = useState(false);
  const ultimaTs = maisAntiga(dados);
  const atrasado = defasado(ultimaTs);
  const ordenadas = [...(dados || [])].sort(
    (a, b) => (b.ultima_leitura?.prob_transbordo || 0) - (a.ultima_leitura?.prob_transbordo || 0)
  );

  async function simular() {
    setSimulando(true);
    try {
      const r = await enviar(`/api/painel/simular/${estacao}`, { cenario, passos: 16, intervalo_s: 1.5 }, true);
      toast.success("Simulação iniciada", { description: `${r.leituras} leituras em ${r.duracao_s} s (cada uma = 15 min).` });
      aoSimular?.();
    } catch (err) {
      toast.error("Não foi possível simular", { description: err.message });
    } finally {
      setSimulando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-ao-vivo" className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="titulo-ao-vivo" className="m-0 text-xl font-bold">Agora nas estações</h2>
        {atrasado ? (
          <span className="risco-atencao inline-flex items-center gap-2 rounded-full bg-risco-fundo px-3 py-1 text-sm font-semibold text-risco">
            <span className="size-2 rounded-full bg-risco" aria-hidden="true" /> atrasado
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-superficie-2 px-3 py-1 text-sm font-semibold text-texto-2">
            <span className="size-2 rounded-full bg-normal motion-safe:animate-pulse" aria-hidden="true" /> ao vivo
          </span>
        )}
      </div>
      <AvisoDefasado ts={ultimaTs} onde={atrasadas(dados)} />
      <MapaEstacoes estacoes={dados} selecionada={estacao} onSelecionar={setEstacao} altura="h-[46dvh] min-h-80 lg:h-[440px]" />
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 xl:grid-cols-5">
        {ordenadas.map((e) => {
          const risco = riscoDe(e);
          const nivel = e.ultima_leitura?.nivel_cm ?? 0;
          return (
            <li key={e.estacao_id}>
              <button
                type="button"
                onClick={() => setEstacao(e.estacao_id)}
                aria-pressed={estacao === e.estacao_id}
                className={cn(
                  "flex h-full w-full items-stretch gap-3 rounded-md border border-borda bg-superficie p-3 text-left hover:border-borda-forte",
                  "aria-pressed:border-linha",
                  classeRisco(risco)
                )}
              >
                <Tubo pct={nivel / e.cota_transbordo_cm} risco={risco} className="h-auto w-2.5" />
                <span className="grid min-w-0 gap-1">
                  <strong className="leading-tight">{e.bairro}</strong>
                  <span className="numero text-2xl">{Math.round((e.ultima_leitura?.prob_transbordo || 0) * 100)}%</span>
                  <span className="text-xs text-texto-3">{Math.round(nivel)} / {e.cota_transbordo_cm} cm</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-borda-forte p-4">
        <p className="m-0 w-full font-semibold">Treinar a equipe com uma chuva simulada</p>
        <Seletor rotulo="Estação" value={estacao} onChange={setEstacao} className="min-w-44 flex-1 sm:flex-none"
          opcoes={(dados || []).map((e) => ({ valor: e.estacao_id, rotulo: e.bairro }))} />
        <Seletor rotulo="Cenário" value={cenario} onChange={setCenario} className="min-w-44 flex-1 sm:flex-none"
          opcoes={[{ valor: "tempestade", rotulo: "Temporal" }, { valor: "chuva_moderada", rotulo: "Chuva moderada" }, { valor: "estiagem", rotulo: "Sem chuva" }]} />
        <Button variant="contorno" onClick={simular} disabled={simulando} className="w-full sm:w-auto">
          <CloudRain size={20} aria-hidden="true" /> {simulando ? "Iniciando…" : "Simular chuva"}
        </Button>
      </div>
    </section>
  );
}

/** Fila da operação: avisa por toast quando chega alerta novo, para quem está olhando o mapa. */
function AlertasOperacao({ versao, aoExpirar }) {
  const { dados, erro } = useDados(`/api/painel/alertas?limite=12&v=${versao}`, { intervalo: 3000, autenticado: true });
  const [atendendo, setAtendendo] = useState(null);
  const vistos = useRef(null);

  useEffect(() => {
    if (erro?.status === 401) aoExpirar();
  }, [erro, aoExpirar]);

  useEffect(() => {
    if (!dados) return;
    const ids = new Set(dados.map((a) => a.id));
    if (vistos.current) {
      dados
        .filter((a) => !vistos.current.has(a.id))
        .forEach((a) => {
          const sms = a.publico === "populacao";
          (a.risco === "EMERGENCIA" || sms ? toast.error : toast.warning)(`${a.bairro}: ${sms ? "alerta à população" : "pré-alerta"}`, {
            description: sms ? `SMS para ${a.destinatarios} morador(es). Chance de ${Math.round(a.prob_transbordo * 100)}%.` : frase(a.motivos[0]),
          });
        });
    }
    vistos.current = ids;
  }, [dados]);

  // marca na hora (sem esperar o próximo polling) e leva o foco para a confirmação daquele card
  const [atendidos, setAtendidos] = useState({});
  const [focar, setFocar] = useState(null);
  const [todos, setTodos] = useState(false);
  useEffect(() => {
    if (focar) document.getElementById(`atendido-${focar}`)?.focus();
  }, [focar]);

  async function atender(id) {
    setAtendendo(id);
    try {
      const r = await enviar(`/api/painel/alertas/${id}/atender`, {}, true);
      setAtendidos((v) => ({ ...v, [id]: r?.atendido_por || "você" }));
      setFocar(id);
      toast.success("Alerta marcado como atendido");
    } catch (err) {
      toast.error("Não foi possível marcar", { description: err.message });
    } finally {
      setAtendendo(null);
    }
  }

  const itens = (dados || []).map((a) => (atendidos[a.id] && !a.atendido_em ? { ...a, atendido_em: "agora", atendido_por: atendidos[a.id] } : a));
  const abertos = itens.filter((a) => !a.atendido_em).length;
  const LIMITE = 3;
  const visiveis = todos ? itens : itens.slice(0, LIMITE);
  return (
    <section aria-labelledby="titulo-operacao" className="grid min-w-0 content-start gap-4 max-lg:order-first">
      <div className="flex items-center gap-3">
        <h2 id="titulo-operacao" className="m-0 text-xl font-bold">Alertas da operação</h2>
        {abertos > 0 && (
          <span className="numero rounded-full bg-linha px-2.5 py-0.5 text-sm text-linha-texto">
            {abertos}<span className="sr"> em aberto</span>
          </span>
        )}
      </div>
      {erro?.status !== 401 && <Erro erro={erro} />}
      {dados && dados.length === 0 && (
        <div className="rounded-lg border border-borda bg-superficie p-6 text-center">
          <p className="m-0 font-semibold">Nenhum alerta nesta sessão</p>
          <p className="mt-1 mb-0 text-sm text-texto-2">Use a chuva simulada para ver a fila funcionando.</p>
        </div>
      )}
      <ol className="m-0 grid list-none gap-2 p-0">
        {visiveis.map((a) => (
          <li key={a.id} className={cn("rounded-md border border-borda bg-superficie p-4", classeRisco(a.risco), a.atendido_em && "opacity-75")}>
            <div className="flex flex-wrap items-center gap-2">
              <SeloRisco risco={a.risco} />
              <span className="text-sm text-texto-3">{horaCurta(a.criado_em)}</span>
            </div>
            <p className="mt-2 mb-1 font-semibold">
              {a.bairro}: {a.publico === "populacao" ? `SMS para ${a.destinatarios} morador(es)` : "pré-alerta interno"}
            </p>
            <p className="m-0 text-sm text-texto-2">
              Chance de {Math.round(a.prob_transbordo * 100)}%. {a.motivos.map(frase).join(". ")}.
            </p>
            <div className="mt-3">
              {a.atendido_em ? (
                <span id={`atendido-${a.id}`} tabIndex={-1} className="inline-flex items-center gap-1.5 text-sm text-normal outline-none focus-visible:outline-2">
                  <CheckCircle size={18} weight="fill" aria-hidden="true" /> atendido por {a.atendido_por}
                </span>
              ) : (
                <Button size="pequeno" variant="contorno" disabled={atendendo === a.id} onClick={() => atender(a.id)}>
                  Marcar atendido
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {itens.length > LIMITE && (
        <Button variant="fantasma" size="pequeno" className="justify-self-start" aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
          {todos ? "Mostrar só os mais recentes" : `Ver todos os alertas (${itens.length})`}
          <CaretDown size={16} weight="bold" className={cn("transition-transform", todos && "rotate-180")} aria-hidden="true" />
        </Button>
      )}
    </section>
  );
}

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Meses entre o início e o fim do histórico ("AAAA-MM-DD"), como opções do seletor. */
function meses(periodo) {
  if (!periodo?.inicio || !periodo?.fim) return [];
  const saida = [];
  let [a, m] = periodo.inicio.split("-").map(Number);
  const [af, mf] = periodo.fim.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    saida.push({ valor: `${a}-${String(m).padStart(2, "0")}`, rotulo: `${NOMES_MES[m - 1]} de ${a}` });
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }
  return saida;
}

function Historico({ estacoes }) {
  const [filtros, setFiltros] = useState({ estacao_id: "", inicio: "", fim: "" });
  const query = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
  const { dados, erro, carregando } = useDados(`/api/painel/resumo?${query}`, { autenticado: true, intervalo: 10000 });
  const ind = dados?.indicadores;
  const periodo = dados?.periodo_disponivel;
  // o período é escolhido por mês da estação chuvosa: mais rápido que digitar duas datas e igual ao resto da interface
  const mesFiltro = filtros.inicio ? filtros.inicio.slice(0, 7) : "";
  const escolherMes = (mes) => {
    if (!mes) return setFiltros({ ...filtros, inicio: "", fim: "" });
    const [a, m] = mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const ini = `${mes}-01` < periodo.inicio ? periodo.inicio : `${mes}-01`;
    const fim = `${mes}-${ultimo}` > periodo.fim ? periodo.fim : `${mes}-${ultimo}`;
    setFiltros({ ...filtros, inicio: ini, fim });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <Seletor rotulo="Estação" value={filtros.estacao_id} onChange={(v) => setFiltros({ ...filtros, estacao_id: v })} className="min-w-48"
          opcoes={[{ valor: "", rotulo: "Todas" }, ...(estacoes || []).map((e) => ({ valor: e.estacao_id, rotulo: e.bairro }))]} />
        <Seletor rotulo="Período" value={mesFiltro} onChange={escolherMes} className="min-w-56"
          opcoes={[{ valor: "", rotulo: "Toda a estação chuvosa" }, ...meses(periodo)]} />
        {query && (
          <Button size="pequeno" variant="fantasma" onClick={() => setFiltros({ estacao_id: "", inicio: "", fim: "" })}>Limpar filtros</Button>
        )}
      </form>

      {carregando && !dados && <Carregando texto="Carregando o histórico" />}
      {erro && erro.status !== 401 && <Erro erro={erro} />}
      {ind && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador rotulo="Enchentes (transbordos)" valor={ind.eventos_transbordo} detalhe={`${ind.pessoas_expostas.toLocaleString("pt-BR")} pessoas em área de risco`} />
            <Indicador destaque rotulo="Aviso antes da água (IA)" valor={ind.antecedencia_media_modelo_min} unidade="min"
              detalhe={ind.ganho_medio_min != null ? `+${br(ind.ganho_medio_min)} min que a régua (${br(ind.antecedencia_media_regra_min)} min)` : null} />
            <Indicador rotulo="Horas acima do transbordo" valor={ind.horas_acima_transbordo} unidade="h" />
            <Indicador rotulo="Chuva acumulada" valor={ind.chuva_media_estacao_mm} unidade="mm"
              detalhe={filtros.estacao_id ? null : "média por estação"} />
            <Indicador rotulo="Completude dos sensores" valor={ind.completude_dados_pct} unidade="%" detalhe="leituras válidas ou recuperadas" />
            <Indicador rotulo="Moradores cadastrados" valor={ind.moradores_cadastrados} detalhe={`${ind.sms_enviados_ao_vivo} SMS enviados`} />
          </div>

          <Card>
            <CardTitulo as="h3" className="m-0">Chuva e nível máximo por dia</CardTitulo>
            <p className="mt-1 mb-4 text-sm text-texto-3">A linha tracejada é a cota de transbordo (100%). Todo pico acima dela é uma enchente.</p>
            <div role="img" aria-label="Chuva diária e nível máximo do córrego em relação ao limite">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={dados.serie_diaria} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke={css("--borda")} vertical={false} />
                  <XAxis dataKey="data" tickFormatter={(d) => d.slice(8, 10) + "/" + d.slice(5, 7)} minTickGap={30} stroke={css("--borda-forte")} />
                  <YAxis yAxisId="c" stroke={css("--borda-forte")} unit=" mm" width={64} />
                  <YAxis yAxisId="n" orientation="right" stroke={css("--borda-forte")} unit="%" width={48} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="n" y={100} stroke={css("--linha")} strokeDasharray="6 4" strokeWidth={2} />
                  <Bar yAxisId="c" dataKey="chuva_mm" name="chuva no dia (mm)" fill={css("--agua")} isAnimationActive={false} />
                  <Line yAxisId="n" dataKey="nivel_max_pct" name="nível máx. (% do limite)" stroke={css("--rio")} dot={false} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 md:p-0">
            <CardTitulo as="h3" className="m-0 px-5 pt-5 md:px-6">Onde agir primeiro</CardTitulo>
            <div className="mt-3 overflow-x-auto" role="region" aria-label="Tabela onde agir primeiro (role para o lado)" tabIndex={0}>
              <table className="w-full border-collapse text-left [&_td]:border-t [&_td]:border-borda [&_td]:px-5 [&_td]:py-3 [&_th]:px-5 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold [&_th]:text-texto-3">
                <thead>
                  <tr><th>Bairro</th><th>Enchentes</th><th>Horas acima</th><th>Chuva (mm)</th><th>Aviso médio (min)</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...dados.por_estacao].sort((a, b) => b.horas_acima_transbordo - a.horas_acima_transbordo).map((e) => (
                    <tr key={e.estacao_id}>
                      <td className="font-semibold">{e.bairro}</td><td>{e.eventos}</td><td>{br(e.horas_acima_transbordo)}</td><td>{br(e.chuva_mm)}</td>
                      <td>{br(e.antecedencia_media_min) ?? SEM_DADO}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 px-5 pt-2 pb-4 text-sm text-texto-3 sm:hidden">Arraste a tabela para o lado para ver todas as colunas.</p>
          </Card>

          <details className="group rounded-lg border border-borda bg-superficie">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold md:px-6">
              Lista de enchentes ({dados.eventos.length})
              <CaretDown size={18} weight="bold" className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="overflow-x-auto pb-2" role="region" aria-label="Lista de enchentes (role para o lado)" tabIndex={0}>
              <table className="w-full border-collapse text-left text-sm [&_td]:border-t [&_td]:border-borda [&_td]:px-5 [&_td]:py-2.5 [&_td]:whitespace-nowrap [&_th]:px-5 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-texto-3">
                <thead>
                  <tr><th>Início</th><th>Estação</th><th>Duração</th><th>Pico (cm)</th><th>Chuva (mm)</th><th>Aviso IA</th><th>Aviso régua</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  {dados.eventos.map((e) => (
                    <tr key={e.evento_id}>
                      <td>{horaCurta(e.inicio)}</td><td>{e.estacao_id}</td><td>{br(e.duracao_min)} min</td><td>{br(e.nivel_pico_cm)}</td>
                      <td>{br(e.chuva_evento_mm)}</td><td>{br(e.antecedencia_modelo_min)} min</td><td>{br(e.antecedencia_regra_min)} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 px-5 pt-2 pb-4 text-sm text-texto-3 sm:hidden">Arraste a tabela para o lado para ver todas as colunas.</p>
          </details>
        </>
      )}
    </div>
  );
}

function Modelo() {
  const { dados: m } = useDados("/api/ia/metricas");
  if (!m?.teste_modelo) return <Carregando texto="Carregando as métricas do modelo" />;
  const a = m.antecedencia_media_min;
  const comparacao = [
    { nome: "Sem sistema", minutos: 0 },
    { nome: "Régua (cota de alerta)", minutos: a.regra_atual },
    { nome: "AlertaCheia (SMS)", minutos: a.alerta_populacao },
    { nome: "AlertaCheia (pré-alerta)", minutos: a.prealerta_defesa_civil },
  ];
  const metricas = [
    ["Enchentes no teste", m.eventos_teste],
    ["ROC AUC", m.teste_modelo.roc_auc],
    ["Precisão (modelo × régua)", `${br(m.teste_modelo.precisao)} × ${br(m.teste_regra_atual.precisao)}`],
    ["Falsos alarmes/semana (SMS × régua)", `${br(m.falsos_alarmes_por_semana.alerta_populacao)} × ${br(m.falsos_alarmes_por_semana.regra_atual)}`],
    ["Enchentes sem aviso prévio", m.varredura_limiares.find((v) => v.limiar === m.limiar_alerta_populacao)?.eventos_nao_antecipados ?? SEM_DADO],
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardTitulo as="h3" className="m-0">Quanto tempo antes da água o aviso chega</CardTitulo>
        <p className="mt-1 mb-4 text-sm text-texto-3">Antecedência média no período de teste, em minutos.</p>
        <div role="img" aria-label="Antecedência média do aviso antes do transbordo">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={comparacao} layout="vertical" margin={{ left: 0, right: 24 }}>
              <CartesianGrid stroke={css("--borda")} horizontal={false} />
              <XAxis type="number" unit=" min" stroke={css("--borda-forte")} />
              <YAxis type="category" dataKey="nome" width={150} stroke={css("--borda-forte")} />
              <Tooltip formatter={(v) => [`${v} min`, "antecedência média"]} cursor={{ fill: "var(--superficie-2)" }} />
              <Bar dataKey="minutos" fill={css("--rio")} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitulo as="h3" className="m-0">Desempenho no teste</CardTitulo>
        <dl className="m-0 mt-3 grid">
          {metricas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-4 border-t border-borda py-3 first:border-t-0">
              <dt className="text-texto-2">{rotulo}</dt>
              <dd className="numero m-0 text-xl">{br(valor)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

export default function Painel() {
  const navegar = useNavigate();
  const [versao, setVersao] = useState(0);
  const { dados: estacoes } = useDados("/api/estacoes");
  // A fila de alertas consulta a cada 3 s com o token: se voltar 401, a sessão expirou.
  const expirar = useCallback(() => {
    salvarToken(null);
    navegar("/painel/login");
  }, [navegar]);

  if (!tokenAtual()) return <Navigate to="/painel/login" replace />;

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-8 pb-14 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold md:text-5xl">Painel da Defesa Civil</h1>
          <p className="mt-2 mb-0 text-lg text-texto-2">Mapa ao vivo, fila de alertas e o histórico da estação chuvosa.</p>
        </div>
        <Button variant="contorno" size="pequeno" className="md:mt-2" onClick={() => { salvarToken(null); navegar("/"); }}>
          <SignOut size={18} aria-hidden="true" /> Sair
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AoVivo aoSimular={() => setVersao((v) => v + 1)} />
        <AlertasOperacao versao={versao} aoExpirar={expirar} />
      </div>

      <Tabs defaultValue="historico" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
        <TabsLista aria-label="Análises" className="justify-self-start">
          <TabsGatilho value="historico">Histórico<span className="hidden sm:inline"> da estação chuvosa</span></TabsGatilho>
          <TabsGatilho value="modelo">Modelo de IA</TabsGatilho>
        </TabsLista>
        <TabsConteudo value="historico"><Historico estacoes={estacoes} /></TabsConteudo>
        <TabsConteudo value="modelo"><Modelo /></TabsConteudo>
      </Tabs>
    </div>
  );
}
