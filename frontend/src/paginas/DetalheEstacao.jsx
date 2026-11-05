import { Link, useParams } from "react-router-dom";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowLeft } from "@phosphor-icons/react";
import { AvisoOffline, BarraNivel, br, Carregando, Erro, Pagina, SeloRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";
import { Card } from "@/components/ui/card";

const hora = (ts) => ts.slice(11, 16);
const css = (v) => `var(${v})`;

function Numero({ valor, rotulo }) {
  return (
    <div className="rounded-lg bg-superficie p-5">
      <div className="numero text-5xl md:text-6xl">{valor}</div>
      <div className="mt-1 text-texto-2">{rotulo}</div>
    </div>
  );
}

export default function DetalheEstacao() {
  const { id } = useParams();
  const { dados, erro, offline, guardadoEm, carregando } = useDados(`/api/estacoes/${id}?horas=24`, { intervalo: 4000 });
  if (carregando && !dados) return <Carregando texto="Carregando as últimas 24 horas da estação" />;
  if (!dados) return <div className="mx-auto max-w-5xl p-5"><Erro erro={erro} /></div>;

  const serie = dados.serie.map((s) => ({ ...s, chance: s.prob_transbordo != null ? Math.round(s.prob_transbordo * 100) : null }));
  const u = dados.ultima_leitura;
  const tetoNivel = Math.ceil(Math.max(...serie.map((s) => s.nivel_cm), dados.cota_transbordo_cm * 1.15) / 50) * 50;

  return (
    <Pagina>
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <Link to="/estacoes" className="inline-flex min-h-11 items-center gap-2 justify-self-start font-semibold">
        <ArrowLeft size={18} weight="bold" aria-hidden="true" /> Mapa das estações
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 text-4xl font-bold md:text-6xl">{dados.bairro}</h1>
        <SeloRisco risco={riscoDe(dados)} grande />
      </div>
      <p className="-mt-2 mb-0 text-lg text-texto-2">
        {dados.corpo_dagua}, {dados.regiao}. Última leitura em {horaCurta(u?.ts)}.
      </p>

      {u && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Numero valor={`${Math.round((u.prob_transbordo || 0) * 100)}%`} rotulo="chance de transbordar em 2 h" />
          <Numero valor={`${Math.round(u.nivel_cm)}`} rotulo={`cm de água (limite ${dados.cota_transbordo_cm} cm)`} />
          <Numero valor={br(u.chuva_1h_mm)} rotulo="mm de chuva na última hora" />
        </div>
      )}
      {u && <BarraNivel nivel={u.nivel_cm} alerta={dados.cota_alerta_cm} transbordo={dados.cota_transbordo_cm} />}

      <Card>
        <h2 className="m-0 mb-4 text-xl font-bold">Nível da água e chuva nas últimas 24 horas</h2>
        <div className="h-80" role="img" aria-label="Gráfico do nível do córrego e da chuva nas últimas 24 horas">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 10, right: 0, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAgua" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={css("--rio")} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={css("--rio")} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={css("--borda")} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={hora} minTickGap={48} stroke={css("--borda-forte")} />
              <YAxis yAxisId="nivel" domain={[0, tetoNivel]} ticks={Array.from({ length: tetoNivel / 50 + 1 }, (_, i) => i * 50)} unit=" cm" width={72} stroke={css("--borda-forte")} />
              <YAxis yAxisId="chuva" orientation="right" unit=" mm" width={56} stroke={css("--borda-forte")} />
              <Tooltip labelFormatter={horaCurta} />
              <Bar yAxisId="chuva" dataKey="chuva_mm" name="chuva (mm/15 min)" fill={css("--agua")} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <ReferenceLine yAxisId="nivel" y={dados.cota_alerta_cm} stroke={css("--atencao")} strokeDasharray="5 4"
                label={{ value: "alerta", fill: css("--atencao"), fontSize: 12, position: "insideTopLeft" }} />
              <ReferenceLine yAxisId="nivel" y={dados.cota_transbordo_cm} stroke={css("--linha")} strokeWidth={2} strokeDasharray="6 4"
                label={{ value: "limite do córrego", fill: css("--linha"), fontSize: 12, position: "insideTopLeft" }} />
              <Area yAxisId="nivel" type="monotone" dataKey="nivel_cm" name="nível (cm)" stroke={css("--rio")} strokeWidth={2.5}
                fill="url(#gradAgua)" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="m-0 mb-1 text-xl font-bold">Chance de transbordar calculada pela IA</h2>
        <p className="mt-0 mb-4 text-texto-2">
          Acima de 60%, a Defesa Civil recebe um pré-alerta. Acima de 80%, os moradores cadastrados recebem SMS.
        </p>
        <div className="h-48" role="img" aria-label="Gráfico da chance de transbordo calculada pelo modelo">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 10, right: 0, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={css("--borda")} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={hora} minTickGap={48} stroke={css("--borda-forte")} />
              <YAxis domain={[0, 100]} unit="%" width={72} stroke={css("--borda-forte")} />
              <Tooltip labelFormatter={horaCurta} />
              <ReferenceLine y={60} stroke={css("--atencao")} strokeDasharray="4 4"
                label={{ value: "pré-alerta 60%", fill: css("--atencao"), fontSize: 12, position: "insideBottomLeft" }} />
              <ReferenceLine y={80} stroke={css("--linha")} strokeDasharray="4 4"
                label={{ value: "SMS 80%", fill: css("--linha"), fontSize: 12, position: "insideTopLeft" }} />
              <Line type="stepAfter" dataKey="chance" name="chance (%)" stroke={css("--linha")} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {dados.alerta_ativo && (
        <Card>
          <h2 className="m-0 mb-3 text-xl font-bold">Por que o sistema emitiu o alerta</h2>
          <ul className="m-0 grid list-disc gap-1.5 pl-5 text-lg marker:text-linha">
            {dados.alerta_ativo.motivos.map((m) => <li key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</li>)}
          </ul>
        </Card>
      )}
    </Pagina>
  );
}
