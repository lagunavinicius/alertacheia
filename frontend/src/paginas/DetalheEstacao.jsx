import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AvisoOffline, Carregando, Erro, SeloRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";

const hora = (ts) => ts.slice(11, 16);

export default function DetalheEstacao() {
  const { id } = useParams();
  const { dados, erro, offline, guardadoEm, carregando } = useDados(`/api/estacoes/${id}?horas=24`, { intervalo: 4000 });
  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Erro erro={erro} />;

  const serie = dados.serie.map((s) => ({ ...s, prob: s.prob_transbordo != null ? Math.round(s.prob_transbordo * 100) : null }));
  const u = dados.ultima_leitura;

  return (
    <div className="pagina">
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <Link to="/estacoes" className="link-voltar">
        <ArrowLeft size={18} weight="bold" aria-hidden="true" /> Todas as estações
      </Link>
      <div className="titulo-com-selo">
        <h1>{dados.bairro}</h1>
        <SeloRisco risco={riscoDe(dados)} grande />
      </div>
      <p className="subtitulo">
        {dados.corpo_dagua}, {dados.regiao}. Última leitura em {horaCurta(u?.ts)}.
      </p>

      <section className="cartao">
        <h2>Nível da água e chuva nas últimas 24 horas</h2>
        <div className="grafico" role="img" aria-label="Gráfico do nível do córrego e da chuva nas últimas 24 horas">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={serie} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={hora} minTickGap={40} stroke="var(--cinza)" fontSize={12} />
              <YAxis yAxisId="nivel" stroke="var(--cinza)" fontSize={12} domain={[0, (max) => Math.ceil(Math.max(max, dados.cota_transbordo_cm * 1.15) / 50) * 50]} allowDecimals={false} unit=" cm" width={70} />
              <YAxis yAxisId="chuva" orientation="right" stroke="var(--cinza)" fontSize={12} unit=" mm" width={55} />
              <Tooltip labelFormatter={horaCurta} formatter={(v, n) => [v, n]} />
              <Bar yAxisId="chuva" dataKey="chuva_mm" name="chuva (mm/15 min)" fill="var(--chuva)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <ReferenceLine yAxisId="nivel" y={dados.cota_alerta_cm} stroke="var(--atencao)" strokeDasharray="5 4" label={{ value: "alerta", fill: "var(--atencao)", fontSize: 12, position: "insideTopLeft" }} />
              <ReferenceLine yAxisId="nivel" y={dados.cota_transbordo_cm} stroke="var(--emergencia)" strokeDasharray="5 4" label={{ value: "transbordo", fill: "var(--emergencia)", fontSize: 12, position: "insideTopLeft" }} />
              <Line yAxisId="nivel" type="monotone" dataKey="nivel_cm" name="nível (cm)" stroke="var(--tinta)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="cartao">
        <h2>Chance de transbordar nas próximas 2 horas (IA)</h2>
        <div className="grafico" role="img" aria-label="Gráfico da probabilidade de transbordo calculada pelo modelo">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={serie} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={hora} minTickGap={40} stroke="var(--cinza)" fontSize={12} />
              <YAxis domain={[0, 100]} unit="%" stroke="var(--cinza)" fontSize={12} width={70} />
              <Tooltip labelFormatter={horaCurta} />
              <ReferenceLine y={60} stroke="var(--atencao)" strokeDasharray="4 4" />
              <ReferenceLine y={80} stroke="var(--alerta)" strokeDasharray="4 4" />
              <Line type="stepAfter" dataKey="prob" name="chance (%)" stroke="var(--alerta)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="legenda">
          Acima de 60%, a Defesa Civil recebe um pré-alerta. Acima de 80%, os moradores cadastrados recebem SMS.
        </p>
      </section>

      {dados.alerta_ativo && (
        <section className="cartao">
          <h2>Por que o sistema emitiu o alerta</h2>
          <ul>
            {dados.alerta_ativo.motivos.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
