import { useState } from "react";
import { Link } from "react-router-dom";
import { AvisoOffline, BarraNivel, Carregando, Erro, RISCO, SeloRisco, horaCurta, riscoDe, useDados } from "../comum.jsx";

function ouvir(texto) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.95;
  window.speechSynthesis.speak(fala);
}

const ORIENTACAO_NORMAL = [
  "Guarde documentos e remédios em saco plástico, num lugar alto.",
  "Salve o número da Defesa Civil: 199.",
  "Cadastre seu telefone para receber o aviso antes da água chegar.",
];

export default function MeuBairro() {
  const { dados: estacoes, erro, offline, guardadoEm, carregando } = useDados("/api/estacoes", { intervalo: 4000 });
  const [escolhida, setEscolhida] = useState(() => localStorage.getItem("ac:estacao") || "EST-03");

  if (carregando && !estacoes) return <Carregando />;
  if (!estacoes) return <Erro erro={erro} />;

  const est = estacoes.find((e) => e.estacao_id === escolhida) || estacoes[0];
  const risco = riscoDe(est);
  const r = RISCO[risco];
  const alerta = est.alerta_ativo;
  const ult = est.ultima_leitura;

  const trocar = (id) => {
    setEscolhida(id);
    localStorage.setItem("ac:estacao", id);
  };

  return (
    <div className="pagina">
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <label className="escolha-bairro">
        <span>Seu bairro</span>
        <select value={est.estacao_id} onChange={(e) => trocar(e.target.value)}>
          {estacoes.map((e) => (
            <option key={e.estacao_id} value={e.estacao_id}>
              {e.bairro} · {e.corpo_dagua}
            </option>
          ))}
        </select>
      </label>

      <section className={`heroi heroi-${r.classe}`} aria-live="polite" aria-atomic="true">
        <div className="heroi-topo">
          <SeloRisco risco={risco} grande />
          <span className="heroi-hora">atualizado {horaCurta(ult?.ts)}</span>
        </div>
        <h1>{alerta ? alerta.titulo : r.frase}</h1>
        <p className="heroi-texto">
          {alerta
            ? alerta.mensagem
            : `O ${est.corpo_dagua} está em ${Math.round((ult?.pct_transbordo || 0) * 100)}% do limite. Não há previsão de transbordo nas próximas 2 horas.`}
        </p>
        {alerta && (
          <button type="button" className="botao botao-claro" onClick={() => ouvir(alerta.texto_audio)}>
            <span aria-hidden="true">🔊</span> Ouvir o alerta
          </button>
        )}
      </section>

      <div className="grade-2">
        <section className="cartao">
          <h2>{alerta ? "O que fazer agora" : "Enquanto não chove"}</h2>
          <ol className="lista-acoes">
            {(alerta ? alerta.acoes : ORIENTACAO_NORMAL).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
          <p className="abrigo">
            Abrigo mais próximo: <strong>{est.abrigo}</strong>
          </p>
        </section>

        <section className="cartao">
          <h2>O córrego agora</h2>
          {ult ? (
            <>
              <p className="numero-grande">
                {Math.round(ult.nivel_cm)} <small>cm</small>
              </p>
              <BarraNivel nivel={ult.nivel_cm} alerta={est.cota_alerta_cm} transbordo={est.cota_transbordo_cm} />
              <dl className="dados-curtos">
                <div>
                  <dt>Chuva na última hora</dt>
                  <dd>{ult.chuva_1h_mm} mm</dd>
                </div>
                <div>
                  <dt>Chance de transbordar em 2 h</dt>
                  <dd>{Math.round((ult.prob_transbordo || 0) * 100)}%</dd>
                </div>
                <div>
                  <dt>Solo</dt>
                  <dd>{ult.umidade_solo_pct >= 75 ? "encharcado" : ult.umidade_solo_pct >= 55 ? "úmido" : "seco"}</dd>
                </div>
              </dl>
              <Link to={`/estacoes/${est.estacao_id}`} className="link-seta">Ver as últimas 24 horas</Link>
            </>
          ) : (
            <p className="vazio">Estação sem leituras.</p>
          )}
        </section>
      </div>

      <section className="faixa-cadastro">
        <div>
          <h2>Receba o aviso no celular</h2>
          <p>
            O alerta chega por SMS em média <strong>uma hora antes</strong> da água, tempo para tirar a família e os
            documentos de casa.
          </p>
        </div>
        <Link to="/cadastro" className="botao">Quero receber</Link>
      </section>
    </div>
  );
}
