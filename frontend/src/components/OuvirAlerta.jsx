import { useEffect, useRef, useState } from "react";
import { CircleNotch, SpeakerHigh, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

// Plano B: a melhor voz pt-BR que o aparelho tiver. As vozes "Natural"/"Online" (Edge, Windows)
// e as do Google são neurais; as demais são as robóticas de sempre.
function melhorVoz() {
  const vozes = window.speechSynthesis.getVoices().filter((v) => /^pt[-_]br/i.test(v.lang));
  return vozes.find((v) => /natural|neural|online/i.test(v.name)) || vozes.find((v) => /google/i.test(v.name)) || vozes[0];
}

/**
 * "Ouvir o alerta": toca a voz neural gerada no servidor (Piper, pt-BR). Sem o modelo no
 * servidor, ou sem internet, cai para a voz do próprio aparelho, então o botão nunca falha.
 */
export function OuvirAlerta({ alertaId, texto }) {
  const [estado, setEstado] = useState("parado"); // parado | carregando | tocando
  const audio = useRef(null);

  const parar = () => {
    audio.current?.pause();
    audio.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setEstado("parado");
  };

  // trocou de alerta ou saiu da tela: para de falar
  useEffect(() => parar, [alertaId]);

  function vozDoAparelho() {
    if (!("speechSynthesis" in window)) return setEstado("parado");
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 0.95;
    const voz = melhorVoz();
    if (voz) fala.voice = voz;
    fala.onend = fala.onerror = () => setEstado("parado");
    setEstado("tocando");
    window.speechSynthesis.speak(fala);
  }

  async function tocar() {
    if (estado !== "parado") return parar();
    setEstado("carregando");
    const som = new Audio(`/api/alertas/${alertaId}/audio`);
    audio.current = som;
    som.onended = () => setEstado("parado");
    som.onplaying = () => setEstado("tocando");
    try {
      await som.play();
    } catch {
      if (audio.current === som) {
        audio.current = null;
        vozDoAparelho();
      }
    }
  }

  const rotulo = { parado: "Ouvir o alerta", carregando: "Preparando a voz…", tocando: "Parar" }[estado];
  const Icone = { parado: SpeakerHigh, carregando: CircleNotch, tocando: Stop }[estado];
  return (
    <Button variant="claro" className="self-start" onClick={tocar}>
      <Icone size={22} weight="bold" className={estado === "carregando" ? "motion-safe:animate-spin" : undefined} aria-hidden="true" />
      {rotulo}
    </Button>
  );
}
