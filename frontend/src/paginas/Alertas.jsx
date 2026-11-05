import { useState } from "react";
import { AvisoOffline, Carregando, Erro, SeloRisco, horaCurta, useDados } from "../comum.jsx";

export default function Alertas() {
  const [filtro, setFiltro] = useState("");
  const { dados: estacoes } = useDados("/api/estacoes");
  const caminho = `/api/alertas?limite=50${filtro ? `&estacao_id=${filtro}` : ""}`;
  const { dados, erro, offline, guardadoEm, carregando } = useDados(caminho, { intervalo: 5000 });

  return (
    <div className="pagina">
      <AvisoOffline offline={offline} guardadoEm={guardadoEm} />
      <h1>Alertas emitidos</h1>
      <p className="subtitulo">Os mesmos avisos que chegam por SMS aos moradores cadastrados.</p>
      <label className="filtro-linha">
        <span>Bairro</span>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos</option>
          {(estacoes || []).map((e) => (
            <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>
          ))}
        </select>
      </label>
      {carregando && !dados && <Carregando />}
      <Erro erro={!dados && erro} />
      {dados && dados.length === 0 && <p className="vazio">Nenhum alerta emitido. Bom sinal.</p>}
      <ol className="lista-alertas">
        {(dados || []).map((a) => (
          <li key={a.id} className={`cartao alerta-item ${a.status === "encerrado" ? "alerta-encerrado" : ""}`}>
            <div className="alerta-topo">
              <SeloRisco risco={a.risco} />
              <span className="cinza">{a.bairro} · {horaCurta(a.criado_em)}</span>
              {a.status === "encerrado" && <span className="etiqueta">encerrado</span>}
            </div>
            <h2>{a.titulo}</h2>
            <p>{a.mensagem}</p>
            <details>
              <summary>Ver o SMS enviado</summary>
              <p className="sms">{a.sms}</p>
              <p className="cinza pequeno">Texto gerado por: {a.gerado_por}</p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
