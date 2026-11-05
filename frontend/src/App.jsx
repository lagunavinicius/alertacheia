import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import MeuBairro from "./paginas/MeuBairro.jsx";
import Estacoes from "./paginas/Estacoes.jsx";
import DetalheEstacao from "./paginas/DetalheEstacao.jsx";
import Alertas from "./paginas/Alertas.jsx";
import Cadastro from "./paginas/Cadastro.jsx";
import Login from "./paginas/Login.jsx";
import Painel from "./paginas/Painel.jsx";

function Acessibilidade() {
  const [grande, setGrande] = useState(() => localStorage.getItem("ac:fonte") === "1");
  const [contraste, setContraste] = useState(() => localStorage.getItem("ac:contraste") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("fonte-grande", grande);
    localStorage.setItem("ac:fonte", grande ? "1" : "0");
  }, [grande]);
  useEffect(() => {
    document.documentElement.classList.toggle("alto-contraste", contraste);
    localStorage.setItem("ac:contraste", contraste ? "1" : "0");
  }, [contraste]);
  return (
    <div className="acessibilidade" aria-label="Opções de leitura">
      <button type="button" aria-pressed={grande} onClick={() => setGrande(!grande)}>
        A<span aria-hidden="true">+</span> <span className="sr">letra grande</span>
      </button>
      <button type="button" aria-pressed={contraste} onClick={() => setContraste(!contraste)}>
        <span aria-hidden="true">◐</span> <span className="sr">alto contraste</span>
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="topo">
        <div className="topo-linha">
          <NavLink to="/" className="marca" aria-label="AlertaCheia, início">
            {/* Símbolo: o "A" de Alerta com a linha de alerta (laranja) acima da água */}
            <svg viewBox="60 60 392 392" aria-hidden="true">
              <path d="M220.8 71.2 L291.2 71.2 L432 440.8 L352.8 440.8 L256 186.7 L159.2 440.8 L80 440.8 Z" fill="#f5f3ee" />
              <path d="M191.3 359.4 C205 351 215 349 223.7 352.9 C238 359 247 368.6 256 368.6 C265 368.6 274 359 288.3 352.9 C297 349 307 351 320.7 359.4 L352.8 440.8 L159.2 440.8 Z" fill="#7aa7d9" />
              <rect x="115.2" y="271.4" width="281.6" height="35.2" rx="17.6" fill="#e0571c" />
            </svg>
            <span>Alerta<b>Cheia</b></span>
          </NavLink>
          <Acessibilidade />
        </div>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/" end>Meu bairro</NavLink>
          <NavLink to="/estacoes">Estações</NavLink>
          <NavLink to="/alertas">Alertas</NavLink>
          <NavLink to="/cadastro">Receber alertas</NavLink>
          <NavLink to="/painel" className="menu-dc">Defesa Civil</NavLink>
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<MeuBairro />} />
          <Route path="/estacoes" element={<Estacoes />} />
          <Route path="/estacoes/:id" element={<DetalheEstacao />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/painel/login" element={<Login />} />
          <Route path="/painel" element={<Painel />} />
          <Route path="*" element={<p className="vazio">Página não encontrada.</p>} />
        </Routes>
      </main>
      <footer className="rodape">
        <p>
          Em perigo, ligue <strong>199</strong> (Defesa Civil) ou <strong>193</strong> (Bombeiros).
        </p>
        <p className="rodape-nota">
          AlertaCheia · Global Solution 2026/2 · FIAP. Protótipo acadêmico: leituras e cotas são simuladas.
        </p>
      </footer>
    </>
  );
}
