import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Bell, CircleHalf, DeviceMobile, House, MapTrifold, ShieldCheck, TextAa } from "@phosphor-icons/react";
import MeuBairro from "./paginas/MeuBairro.jsx";
import Estacoes from "./paginas/Estacoes.jsx";
import Alertas from "./paginas/Alertas.jsx";
import Cadastro from "./paginas/Cadastro.jsx";
import Login from "./paginas/Login.jsx";
import Privacidade from "./paginas/Privacidade.jsx";
import NaoEncontrada from "./paginas/NaoEncontrada.jsx";
import { Carregando } from "./comum.jsx";

// As telas com gráficos (Recharts, ~450 kB) só baixam quando abertas: o morador
// num celular simples abre "Meu bairro" sem carregar a biblioteca de gráficos.
const DetalheEstacao = lazy(() => import("./paginas/DetalheEstacao.jsx"));
const Painel = lazy(() => import("./paginas/Painel.jsx"));

const MENU = [
  { para: "/", rotulo: "Meu bairro", Icone: House, fim: true },
  { para: "/estacoes", rotulo: "Estações", Icone: MapTrifold },
  { para: "/alertas", rotulo: "Alertas", Icone: Bell },
  { para: "/cadastro", rotulo: "Receber alertas", Icone: DeviceMobile },
];

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
    <div className="acessibilidade" role="group" aria-label="Opções de leitura">
      <button type="button" aria-pressed={grande} onClick={() => setGrande(!grande)} title="Letra grande">
        <TextAa size={22} weight="bold" aria-hidden="true" />
        <span className="sr">Letra grande</span>
      </button>
      <button type="button" aria-pressed={contraste} onClick={() => setContraste(!contraste)} title="Alto contraste">
        <CircleHalf size={22} weight="bold" aria-hidden="true" />
        <span className="sr">Alto contraste</span>
      </button>
    </div>
  );
}

function Marca() {
  return (
    <NavLink to="/" className="marca" aria-label="AlertaCheia, início">
      {/* Símbolo: o "A" de Alerta com a linha de alerta (laranja) acima da água */}
      <svg viewBox="60 60 392 392" aria-hidden="true">
        <path d="M220.8 71.2 L291.2 71.2 L432 440.8 L352.8 440.8 L256 186.7 L159.2 440.8 L80 440.8 Z" fill="var(--marca-a)" />
        <path d="M191.3 359.4 C205 351 215 349 223.7 352.9 C238 359 247 368.6 256 368.6 C265 368.6 274 359 288.3 352.9 C297 349 307 351 320.7 359.4 L352.8 440.8 L159.2 440.8 Z" fill="var(--agua)" />
        <rect x="115.2" y="271.4" width="281.6" height="35.2" rx="17.6" fill="var(--alerta-vivo)" />
      </svg>
      <span className="marca-nome">Alerta<b>Cheia</b></span>
    </NavLink>
  );
}

export default function App() {
  return (
    <>
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="topo">
        <div className="topo-linha">
          <Marca />
          <div className="topo-acoes">
            <Acessibilidade />
            <NavLink to="/painel" className="topo-dc">
              <ShieldCheck size={20} weight="bold" aria-hidden="true" />
              Defesa Civil
            </NavLink>
          </div>
        </div>
        {/* No celular vira barra inferior: os 4 destinos do morador ficam ao alcance do polegar */}
        <nav className="menu" aria-label="Principal">
          {MENU.map(({ para, rotulo, Icone, fim }) => (
            <NavLink key={para} to={para} end={fim}>
              {({ isActive }) => (
                <>
                  <Icone size={24} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                  <span>{rotulo}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<MeuBairro />} />
            <Route path="/estacoes" element={<Estacoes />} />
            <Route path="/estacoes/:id" element={<DetalheEstacao />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/painel/login" element={<Login />} />
            <Route path="/painel" element={<Painel />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="rodape">
        <p>
          Em perigo, ligue <a href="tel:199"><strong>199</strong></a> (Defesa Civil) ou{" "}
          <a href="tel:193"><strong>193</strong></a> (Bombeiros).
        </p>
        <p className="rodape-nota">
          AlertaCheia, Global Solution 2026/2, FIAP. Protótipo acadêmico: leituras e cotas são simuladas.{" "}
          <NavLink to="/privacidade">Como usamos os seus dados</NavLink>
        </p>
      </footer>
    </>
  );
}
