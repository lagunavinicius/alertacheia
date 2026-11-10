import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import * as maplibregl from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// O MapLibre 6 procura o worker ao lado do próprio arquivo; depois do build do Vite
// ele mora em outro caminho, então informamos a URL do asset gerado.
maplibregl.setWorkerUrl(urlWorker);
import { MapTrifold } from "@phosphor-icons/react";
import { RISCO, classeRisco, riscoDe } from "../comum.jsx";
import { cn } from "@/lib/utils";

// Base vetorial gratuita e sem chave (OpenFreeMap, dados do OpenStreetMap).
// Os córregos e rios da cidade são repintados com o azul da marca: no AlertaCheia
// a água é a informação principal do mapa, não um detalhe do fundo.
const ESTILO = {
  escuro: "https://tiles.openfreemap.org/styles/dark",
  claro: "https://tiles.openfreemap.org/styles/positron",
};

function useTema() {
  // o alto contraste usa a paleta escura em qualquer tema, então o mapa também fica escuro
  const ler = () => {
    const d = document.documentElement.dataset;
    return d.contraste === "alto" ? "escuro" : d.tema || "escuro";
  };
  const [tema, setTema] = useState(ler);
  useEffect(() => {
    const obs = new MutationObserver(() => setTema(ler()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-contraste"] });
    return () => obs.disconnect();
  }, []);
  return tema;
}

const cor = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

function realcarAgua(mapa) {
  if (mapa.getLayer("waterway")) {
    mapa.setPaintProperty("waterway", "line-color", cor("--rio"));
    mapa.setPaintProperty("waterway", "line-width", ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 2, 15, 5]);
    mapa.setPaintProperty("waterway", "line-opacity", 0.9);
  }
  if (mapa.getLayer("water")) mapa.setPaintProperty("water", "fill-color", cor("--agua-funda"));
}

export default function MapaEstacoes({ estacoes, selecionada, onSelecionar, className, altura = "h-full" }) {
  const tema = useTema();
  const mapa = useRef(null);
  const [falhou, setFalhou] = useState(false);

  // o estilo do OpenFreeMap cita ícones que não publica (ex.: "wood-pattern"): um pixel vazio evita o aviso.
  // O react-map-gl cria o mapa de forma assíncrona; o primeiro "styledata" chega antes de desenhar as camadas.
  const preencherImagens = useCallback((e) => {
    const m = e.target;
    if (m.__imagensVazias) return;
    m.__imagensVazias = true;
    const vazia = (id) => { if (!m.hasImage(id)) m.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) }); };
    ["wood-pattern", "circle-11"].forEach(vazia); // pedidos antes do evento de imagem ausente
    m.on("styleimagemissing", (ev) => vazia(ev.id));
  }, []);

  const aoCarregar = useCallback((e) => {
    const m = e.target;
    realcarAgua(m);
    m.on("style.load", () => realcarAgua(m));
    if (estacoes?.length) {
      const lons = estacoes.map((s) => s.lon);
      const lats = estacoes.map((s) => s.lat);
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 70, duration: 0 });
    }
  }, [estacoes]);

  if (falhou) {
    return (
      <div className={cn("grid place-items-center rounded-lg border border-borda bg-superficie p-6 text-center text-texto-2", altura, className)}>
        <div>
          <MapTrifold size={32} className="mx-auto mb-2 text-texto-3" aria-hidden="true" />
          O mapa não carregou (sem internet ou sem suporte a WebGL). A lista de estações continua funcionando.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-borda", altura, className)}>
      <Map
        ref={mapa}
        initialViewState={{ longitude: -46.6, latitude: -23.53, zoom: 10 }}
        mapStyle={ESTILO[tema] || ESTILO.escuro}
        onStyleData={preencherImagens}
        onLoad={aoCarregar}
        onError={(e) => { if (!mapa.current) setFalhou(true); else console.warn(e?.error); }}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        cooperativeGestures
      >
        <NavigationControl position="top-right" showCompass={false} />
        {(estacoes || []).map((e) => {
          const risco = riscoDe(e);
          // Duas estações vizinhas: o rótulo da mais ao norte sobe, para os nomes não se cobrirem.
          const sobe = (estacoes || []).some((o) => o !== e && Math.hypot(o.lat - e.lat, o.lon - e.lon) < 0.06 && o.lat < e.lat);
          const ativo = selecionada === e.estacao_id;
          return (
            <Marker key={e.estacao_id} longitude={e.lon} latitude={e.lat} anchor="center">
              <button
                type="button"
                onClick={() => onSelecionar?.(e.estacao_id)}
                className={cn("ponto-estacao", classeRisco(risco), RISCO[risco].ordem >= 2 && "pulsa", ativo && "outline-3 outline-offset-2 outline-linha")}
                aria-label={`${e.bairro}: ${RISCO[risco].rotulo}. Abrir detalhes`}
              />
              <span className={cn("pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-noite/85 px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-texto", sobe ? "bottom-7" : "top-7")}>
                {e.bairro}
              </span>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
