import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Bell, CircleHalf, DeviceMobile, House, MapTrifold, Moon, ShieldCheck, Sun, TextAa } from "@phosphor-icons/react";
import MeuBairro from "./paginas/MeuBairro.jsx";
import Alertas from "./paginas/Alertas.jsx";
import Cadastro from "./paginas/Cadastro.jsx";
import Login from "./paginas/Login.jsx";
import Privacidade from "./paginas/Privacidade.jsx";
import NaoEncontrada from "./paginas/NaoEncontrada.jsx";
import { Carregando } from "./comum.jsx";
import { cn } from "@/lib/utils";

// Mapa (MapLibre, WebGL) e gráficos (Recharts) só baixam nas telas que os usam:
// "Meu bairro" abre rápido mesmo num celular simples.
const Estacoes = lazy(() => import("./paginas/Estacoes.jsx"));
const DetalheEstacao = lazy(() => import("./paginas/DetalheEstacao.jsx"));
const Painel = lazy(() => import("./paginas/Painel.jsx"));

const MENU = [
  { para: "/", rotulo: "Meu bairro", Icone: House, fim: true },
  { para: "/estacoes", rotulo: "Mapa", Icone: MapTrifold },
  { para: "/alertas", rotulo: "Alertas", Icone: Bell },
  { para: "/cadastro", rotulo: "Receber alertas", Icone: DeviceMobile },
];

function usePreferencia(chave, padrao) {
  const [valor, setValor] = useState(() => localStorage.getItem(chave) ?? padrao);
  useEffect(() => localStorage.setItem(chave, valor), [chave, valor]);
  return [valor, setValor];
}

function BotaoTopo({ ativo, onClick, rotulo, children }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      title={rotulo}
      className={cn(
        "grid size-11 place-items-center rounded-full border border-white/20 text-[#eef2f7] transition-colors hover:border-white/60",
        ativo && "border-transparent bg-[#eef2f7] text-[#0a1322]"
      )}
    >
      {children}
      <span className="sr">{rotulo}</span>
    </button>
  );
}

function Exibicao() {
  const [tema, setTema] = usePreferencia("ac:tema", "escuro");
  const [fonte, setFonte] = usePreferencia("ac:fonte", "0");
  const [contraste, setContraste] = usePreferencia("ac:contraste", "0");
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.tema = tema;
    html.classList.toggle("fonte-grande", fonte === "1");
    if (contraste === "1") html.dataset.contraste = "alto";
    else delete html.dataset.contraste;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "claro" ? "#f3f1ec" : "#0a1322");
  }, [tema, fonte, contraste]);
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Opções de exibição">
      <BotaoTopo ativo={tema === "claro"} onClick={() => setTema(tema === "claro" ? "escuro" : "claro")} rotulo="Tema claro">
        {tema === "claro" ? <Sun size={20} weight="bold" aria-hidden="true" /> : <Moon size={20} weight="bold" aria-hidden="true" />}
      </BotaoTopo>
      <BotaoTopo ativo={fonte === "1"} onClick={() => setFonte(fonte === "1" ? "0" : "1")} rotulo="Letra grande">
        <TextAa size={20} weight="bold" aria-hidden="true" />
      </BotaoTopo>
      <BotaoTopo ativo={contraste === "1"} onClick={() => setContraste(contraste === "1" ? "0" : "1")} rotulo="Alto contraste">
        <CircleHalf size={20} weight="bold" aria-hidden="true" />
      </BotaoTopo>
    </div>
  );
}

function Marca() {
  return (
    <NavLink to="/" className="flex min-h-11 items-center gap-2.5 text-[#eef2f7] no-underline" aria-label="AlertaCheia, início">
      {/* Símbolo: o "A" de Alerta com a linha de alerta (laranja) acima da água */}
      <svg viewBox="60 60 392 392" className="size-9 shrink-0" aria-hidden="true">
        <path d="M220.8 71.2 L291.2 71.2 L432 440.8 L352.8 440.8 L256 186.7 L159.2 440.8 L80 440.8 Z" fill="#eef2f7" />
        <path d="M191.3 359.4 C205 351 215 349 223.7 352.9 C238 359 247 368.6 256 368.6 C265 368.6 274 359 288.3 352.9 C297 349 307 351 320.7 359.4 L352.8 440.8 L159.2 440.8 Z" fill="#5aa7ee" />
        <rect x="115.2" y="271.4" width="281.6" height="35.2" rx="17.6" fill="#ff6a2b" />
      </svg>
      <span className="marca-nome text-[1.35rem] font-semibold tracking-tight">
        Alerta<b className="font-bold">Cheia</b>
      </span>
    </NavLink>
  );
}

function LinkMenu({ para, rotulo, Icone, fim, inferior }) {
  return (
    <NavLink
      to={para}
      end={fim}
      className={({ isActive }) =>
        cn(
          "relative flex items-center no-underline transition-colors",
          inferior
            ? "min-h-[68px] flex-col justify-center gap-1 px-1 text-center text-[0.75rem] leading-tight [overflow-wrap:anywhere]"
            : "min-h-12 gap-2 rounded-full px-4 font-semibold",
          isActive ? "text-[#eef2f7]" : "text-[#eef2f7]/65 hover:text-[#eef2f7]",
          isActive && !inferior && "bg-white/10",
          isActive && inferior && "after:absolute after:inset-x-6 after:top-0 after:h-[3px] after:rounded-b after:bg-[#ff6a2b]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icone size={inferior ? 24 : 20} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
          <span>{rotulo}</span>
        </>
      )}
    </NavLink>
  );
}

export default function App() {
  return (
    <>
      <a href="#conteudo" className="fixed left-2 top-2 z-[60] -translate-y-24 rounded-full bg-[#eef2f7] px-4 py-2 font-semibold text-[#0a1322] focus:translate-y-0">
        Pular para o conteúdo
      </a>
      {/* o topo é sempre noite, em qualquer tema: a marca vive sobre o escuro */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a1322]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
          <Marca />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {MENU.map((m) => <LinkMenu key={m.para} {...m} />)}
          </nav>
          <div className="flex items-center gap-1.5">
            <Exibicao />
            <NavLink
              to="/painel"
              className={({ isActive }) =>
                cn(
                  "ml-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-3 font-semibold text-[#eef2f7] no-underline hover:border-white/60 md:px-4",
                  isActive && "border-transparent bg-[#eef2f7] text-[#0a1322]"
                )
              }
            >
              <ShieldCheck size={20} weight="bold" aria-hidden="true" />
              <span className="max-[420px]:sr">Defesa Civil</span>
            </NavLink>
          </div>
        </div>
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

      <footer className="border-t border-borda px-5 pt-8 pb-10 text-center text-texto-3">
        <p className="m-0">
          Em perigo, ligue <a href="tel:199" className="font-bold text-texto">199</a> (Defesa Civil) ou{" "}
          <a href="tel:193" className="font-bold text-texto">193</a> (Bombeiros).
        </p>
        <p className="mt-1 text-sm">
          AlertaCheia, Global Solution 2026/2, FIAP. Protótipo acadêmico: leituras e cotas são simuladas.{" "}
          <NavLink to="/privacidade" className="underline">Como usamos os seus dados</NavLink>
        </p>
      </footer>

      {/* no celular, os 4 destinos do morador ficam ao alcance do polegar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#0a1322] pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Principal (celular)"
      >
        {MENU.map((m) => <LinkMenu key={m.para} {...m} inferior />)}
      </nav>

      <Toaster position="top-right" theme="dark" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
    </>
  );
}
