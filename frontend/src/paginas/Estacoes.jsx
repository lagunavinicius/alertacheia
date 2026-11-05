import { Link, useNavigate } from "react-router-dom";
import { AvisoOffline, BarraNivel, Carregando, Erro, RISCO, SeloRisco, riscoDe, useDados } from "../comum.jsx";

// Projeção simples (equiretangular) do recorte de São Paulo onde estão as estações.
const LIMITES = { lonMin: -46.82, lonMax: -46.36, latMin: -23.64, latMax: -23.41 };
const L = 640;
const A = 360;
const xy = (lat, lon) => [
  ((lon - LIMITES.lonMin) / (LIMITES.lonMax - LIMITES.lonMin)) * L,
  ((LIMITES.latMax - lat) / (LIMITES.latMax - LIMITES.latMin)) * A,
];

// Traçado esquemático do Rio Tietê (aproximado, só para orientação visual)
const TIETE = [
  [-23.52, -46.82], [-23.515, -46.74], [-23.515, -46.68], [-23.51, -46.62],
  [-23.515, -46.58], [-23.5, -46.52], [-23.495, -46.46], [-23.49, -46.39],
].map(([la, lo]) => xy(la, lo).join(",")).join(" ");

export default function Estacoes() {
  const { dados, erro, offline, guardadoEm, carregando } = useDados("/api/estacoes", { intervalo: 4000 });
  const navegar = useNavigate();
  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Erro erro={erro} />;

  return (
    <div className="pagina">
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <h1>Estações de monitoramento</h1>
      <p className="subtitulo">
        Cinco sensores medem, a cada 15 minutos, o nível da água, a chuva e a umidade do solo em pontos com histórico de
        enchente.
      </p>

      <figure className="mapa cartao">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Mapa esquemático das estações em São Paulo">
          <rect width={L} height={A} className="mapa-fundo" rx="10" />
          <polyline points={TIETE} className="mapa-rio" />
          <text x="20" y={xy(-23.505, -46.8)[1] - 10} className="mapa-rotulo-rio">Rio Tietê</text>
          {dados.map((e) => {
            const [x, y] = xy(e.lat, e.lon);
            const classe = RISCO[riscoDe(e)].classe;
            return (
              <g
                key={e.estacao_id}
                className={`mapa-ponto mapa-${classe}`}
                transform={`translate(${x},${y})`}
                tabIndex={0}
                role="link"
                aria-label={`${e.bairro}: ${RISCO[riscoDe(e)].rotulo}`}
                onClick={() => navegar(`/estacoes/${e.estacao_id}`)}
                onKeyDown={(ev) => ev.key === "Enter" && navegar(`/estacoes/${e.estacao_id}`)}
              >
                {classe !== "normal" && <circle r="22" className="mapa-pulso" />}
                <circle r="9" />
                {/* Jardim Pantanal e Jardim Romano são vizinhos: um rótulo vai embaixo */}
                <text y={e.estacao_id === "EST-01" ? 28 : -16} textAnchor={e.estacao_id === "EST-01" ? "end" : "middle"}>
                  {e.bairro}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption>Posição aproximada. Toque numa estação para ver o detalhe.</figcaption>
      </figure>

      <ul className="lista-estacoes">
        {dados.map((e) => {
          const u = e.ultima_leitura;
          return (
            <li key={e.estacao_id}>
              <Link to={`/estacoes/${e.estacao_id}`} className="cartao cartao-estacao">
                <div className="cartao-estacao-topo">
                  <div>
                    <strong>{e.bairro}</strong>
                    <span className="cinza">{e.corpo_dagua} · {e.regiao}</span>
                  </div>
                  <SeloRisco risco={riscoDe(e)} />
                </div>
                {u && (
                  <>
                    <BarraNivel nivel={u.nivel_cm} alerta={e.cota_alerta_cm} transbordo={e.cota_transbordo_cm} />
                    <div className="linha-numeros">
                      <span>{Math.round(u.nivel_cm)} cm de {e.cota_transbordo_cm} cm</span>
                      <span>chuva 1 h: {u.chuva_1h_mm} mm</span>
                      <span>chance 2 h: {Math.round((u.prob_transbordo || 0) * 100)}%</span>
                    </div>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
