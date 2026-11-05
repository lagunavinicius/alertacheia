import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { enviar, salvarToken, tokenAtual } from "../api.js";
import { Carregando, Erro, SEM_DADO, SeloRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";

function Indicador({ rotulo, valor, unidade, detalhe, destaque }) {
  return (
    <div className={`indicador ${destaque ? "indicador-destaque" : ""}`}>
      <span className="indicador-rotulo">{rotulo}</span>
      <span className="indicador-valor">
        {valor ?? SEM_DADO}
        {valor != null && unidade && <small> {unidade}</small>}
      </span>
      {detalhe && <span className="indicador-detalhe">{detalhe}</span>}
    </div>
  );
}

function AoVivo({ aoSimular }) {
  const { dados } = useDados("/api/estacoes", { intervalo: 3000 });
  const [estacao, setEstacao] = useState("EST-03");
  const [cenario, setCenario] = useState("tempestade");
  const [msg, setMsg] = useState(null);

  async function simular() {
    setMsg(null);
    try {
      const r = await enviar(`/api/painel/simular/${estacao}`, { cenario, passos: 16, intervalo_s: 1.5 }, true);
      setMsg(`Simulação iniciada: ${r.leituras} leituras em ${r.duracao_s} s (cada uma = 15 min).`);
      aoSimular?.();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <section className="cartao">
      <div className="secao-topo">
        <h2>Agora nas estações</h2>
        <span className="ao-vivo" aria-hidden="true">Ao vivo</span>
      </div>
      <ul className="faixa-estacoes">
        {(dados || []).map((e) => (
          <li key={e.estacao_id} className={`mini mini-${riscoDe(e).toLowerCase()}`}>
            <strong>{e.bairro}</strong>
            <SeloRisco risco={riscoDe(e)} />
            <span>{Math.round(e.ultima_leitura?.nivel_cm ?? 0)} / {e.cota_transbordo_cm} cm</span>
            <span>chance 2 h: {Math.round((e.ultima_leitura?.prob_transbordo || 0) * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className="simulador">
        <span className="simulador-rotulo">Treinar a equipe:</span>
        <select value={estacao} onChange={(e) => setEstacao(e.target.value)} aria-label="Estação">
          {(dados || []).map((e) => <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>)}
        </select>
        <select value={cenario} onChange={(e) => setCenario(e.target.value)} aria-label="Cenário">
          <option value="tempestade">Temporal</option>
          <option value="chuva_moderada">Chuva moderada</option>
          <option value="estiagem">Sem chuva</option>
        </select>
        <button type="button" className="botao botao-secundario" onClick={simular}>Simular chuva</button>
        {msg && <span className="cinza" role="status">{msg}</span>}
      </div>
    </section>
  );
}

function AlertasOperacao({ versao }) {
  const { dados, erro } = useDados(`/api/painel/alertas?limite=12&v=${versao}`, { intervalo: 3000, autenticado: true });
  const [atendendo, setAtendendo] = useState(null);
  async function atender(id) {
    setAtendendo(id);
    try {
      await enviar(`/api/painel/alertas/${id}/atender`, {}, true);
    } finally {
      setAtendendo(null);
    }
  }
  return (
    <section className="cartao">
      <h2>Alertas da operação</h2>
      <Erro erro={erro} />
      {dados && dados.length === 0 && <p className="vazio">Nenhum alerta emitido nesta sessão.</p>}
      <ul className="lista-operacao">
        {(dados || []).map((a) => (
          <li key={a.id}>
            <SeloRisco risco={a.risco} />
            <div>
              <strong>{a.bairro}</strong>: {a.publico === "populacao" ? `SMS para ${a.destinatarios} morador(es)` : "pré-alerta interno"}
              <span className="cinza">, {horaCurta(a.criado_em)}, chance de {Math.round(a.prob_transbordo * 100)}%</span>
              <p className="pequeno">{a.motivos.join("; ")}</p>
            </div>
            {a.atendido_em ? (
              <span className="etiqueta etiqueta-ok">atendido por {a.atendido_por}</span>
            ) : (
              <button type="button" className="botao botao-pequeno" disabled={atendendo === a.id} onClick={() => atender(a.id)}>
                Marcar atendido
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Modelo() {
  const { dados: m } = useDados("/api/ia/metricas");
  if (!m?.teste_modelo) return null;
  const a = m.antecedencia_media_min;
  const comparacao = [
    { nome: "Sem sistema", minutos: 0 },
    { nome: "Régua (cota de alerta)", minutos: a.regra_atual },
    { nome: "AlertaCheia (SMS)", minutos: a.alerta_populacao },
    { nome: "AlertaCheia (pré-alerta)", minutos: a.prealerta_defesa_civil },
  ];
  return (
    <section className="cartao">
      <h2>Desempenho do modelo de IA (período de teste)</h2>
      <div className="grade-2">
        <div className="grafico" role="img" aria-label="Antecedência média do aviso antes do transbordo">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparacao} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid stroke="var(--linha)" horizontal={false} />
              <XAxis type="number" unit=" min" stroke="var(--cinza)" fontSize={12} />
              <YAxis type="category" dataKey="nome" width={150} stroke="var(--cinza)" fontSize={12} />
              <Tooltip formatter={(v) => [`${v} min`, "antecedência média"]} />
              <Bar dataKey="minutos" fill="var(--tinta)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <dl className="metricas">
          <div><dt>Enchentes no teste</dt><dd>{m.eventos_teste}</dd></div>
          <div><dt>ROC AUC</dt><dd>{m.teste_modelo.roc_auc}</dd></div>
          <div><dt>Precisão (modelo × régua)</dt><dd>{m.teste_modelo.precisao} × {m.teste_regra_atual.precisao}</dd></div>
          <div><dt>Falsos alarmes/semana (SMS × régua)</dt><dd>{m.falsos_alarmes_por_semana.alerta_populacao} × {m.falsos_alarmes_por_semana.regra_atual}</dd></div>
          <div><dt>Enchentes sem aviso prévio</dt><dd>{m.varredura_limiares.find((v) => v.limiar === m.limiar_alerta_populacao)?.eventos_nao_antecipados ?? SEM_DADO}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export default function Painel() {
  const navegar = useNavigate();
  const [filtros, setFiltros] = useState({ estacao_id: "", inicio: "", fim: "" });
  const [versao, setVersao] = useState(0);
  const query = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
  const { dados, erro, carregando } = useDados(`/api/painel/resumo?${query}`, { autenticado: true, intervalo: 10000 });
  const { dados: estacoes } = useDados("/api/estacoes");

  useEffect(() => {
    if (erro?.status === 401) {
      salvarToken(null);
      navegar("/painel/login");
    }
  }, [erro, navegar]);

  if (!tokenAtual()) return <Navigate to="/painel/login" replace />;

  const ind = dados?.indicadores;
  const periodo = dados?.periodo_disponivel;
  const mudar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });

  return (
    <div className="pagina pagina-larga">
      <div className="secao-topo">
        <h1>Painel da Defesa Civil</h1>
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => { salvarToken(null); navegar("/"); }}>
          Sair
        </button>
      </div>

      <AoVivo aoSimular={() => setVersao((v) => v + 1)} />
      <AlertasOperacao versao={versao} />

      <section className="cartao">
        <div className="secao-topo">
          <h2>Histórico da estação chuvosa</h2>
          <form className="filtros" onSubmit={(e) => e.preventDefault()}>
            <label>
              Estação
              <select value={filtros.estacao_id} onChange={mudar("estacao_id")}>
                <option value="">Todas</option>
                {(estacoes || []).map((e) => <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>)}
              </select>
            </label>
            <label>
              De
              <input type="date" value={filtros.inicio} min={periodo?.inicio} max={periodo?.fim} onChange={mudar("inicio")} />
            </label>
            <label>
              Até
              <input type="date" value={filtros.fim} min={periodo?.inicio} max={periodo?.fim} onChange={mudar("fim")} />
            </label>
            {query && <button type="button" className="botao botao-pequeno botao-secundario" onClick={() => setFiltros({ estacao_id: "", inicio: "", fim: "" })}>Limpar</button>}
          </form>
        </div>

        {carregando && !dados && <Carregando />}
        {erro && erro.status !== 401 && <Erro erro={erro} />}
        {ind && (
          <>
            <div className="indicadores">
              <Indicador rotulo="Enchentes (transbordos)" valor={ind.eventos_transbordo} detalhe={`${ind.pessoas_expostas.toLocaleString("pt-BR")} pessoas em área de risco`} />
              <Indicador destaque rotulo="Aviso antes da água (IA)" valor={ind.antecedencia_media_modelo_min} unidade="min"
                detalhe={ind.ganho_medio_min != null ? `+${ind.ganho_medio_min} min que a régua (${ind.antecedencia_media_regra_min} min)` : null} />
              <Indicador rotulo="Horas acima do transbordo" valor={ind.horas_acima_transbordo} unidade="h" />
              <Indicador rotulo="Chuva acumulada" valor={ind.chuva_media_estacao_mm?.toLocaleString("pt-BR")} unidade="mm"
                detalhe={filtros.estacao_id ? null : "média por estação"} />
              <Indicador rotulo="Completude dos sensores" valor={ind.completude_dados_pct} unidade="%" detalhe="leituras válidas ou recuperadas" />
              <Indicador rotulo="Moradores cadastrados" valor={ind.moradores_cadastrados} detalhe={`${ind.sms_enviados_ao_vivo} SMS enviados`} />
            </div>

            <h3>Chuva e nível máximo por dia</h3>
            <div className="grafico" role="img" aria-label="Chuva diária e nível máximo do córrego em relação ao limite">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={dados.serie_diaria} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--linha)" vertical={false} />
                  <XAxis dataKey="data" tickFormatter={(d) => d.slice(8, 10) + "/" + d.slice(5, 7)} minTickGap={30} stroke="var(--cinza)" fontSize={12} />
                  <YAxis yAxisId="c" stroke="var(--cinza)" fontSize={12} unit=" mm" width={70} />
                  <YAxis yAxisId="n" orientation="right" stroke="var(--cinza)" fontSize={12} unit="%" width={55} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="n" y={100} stroke="var(--emergencia)" strokeDasharray="5 4" />
                  <Bar yAxisId="c" dataKey="chuva_mm" name="chuva no dia (mm)" fill="var(--chuva)" isAnimationActive={false} />
                  <Line yAxisId="n" dataKey="nivel_max_pct" name="nível máx. (% do limite)" stroke="var(--tinta)" dot={false} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="legenda">A linha tracejada é a cota de transbordo (100%). Todo pico acima dela é uma enchente.</p>

            <h3>Onde agir primeiro</h3>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr><th>Bairro</th><th>Enchentes</th><th>Horas acima do transbordo</th><th>Chuva (mm)</th><th>Aviso médio (min)</th></tr>
                </thead>
                <tbody>
                  {[...dados.por_estacao].sort((a, b) => b.horas_acima_transbordo - a.horas_acima_transbordo).map((e) => (
                    <tr key={e.estacao_id}>
                      <td>{e.bairro}</td><td>{e.eventos}</td><td>{e.horas_acima_transbordo}</td><td>{e.chuva_mm}</td><td>{e.antecedencia_media_min ?? SEM_DADO}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details>
              <summary>Lista de enchentes ({dados.eventos.length})</summary>
              <div className="tabela-rolagem">
                <table>
                  <thead>
                    <tr><th>Início</th><th>Estação</th><th>Duração</th><th>Pico (cm)</th><th>Chuva (mm)</th><th>Aviso IA</th><th>Aviso régua</th></tr>
                  </thead>
                  <tbody>
                    {dados.eventos.map((e) => (
                      <tr key={e.evento_id}>
                        <td>{horaCurta(e.inicio)}</td><td>{e.estacao_id}</td><td>{e.duracao_min} min</td><td>{e.nivel_pico_cm}</td>
                        <td>{e.chuva_evento_mm}</td><td>{e.antecedencia_modelo_min} min</td><td>{e.antecedencia_regra_min} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <Modelo />
    </div>
  );
}
