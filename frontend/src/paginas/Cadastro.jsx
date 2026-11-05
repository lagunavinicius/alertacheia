import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaretDown, CheckCircle, ChatCircleText, DeviceMobile, LockKey } from "@phosphor-icons/react";
import { apagar, enviar } from "../api.js";
import { Pagina, useDados } from "../comum.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const VAZIO = { nome: "", telefone: "", estacao_id: "EST-03", mobilidade_reduzida: false, canal: "sms", consentimento_lgpd: false };
const ORDEM = ["nome", "telefone", "estacao_id", "consentimento_lgpd"];
// A API valida; a tela explica em português simples o que fazer em cada campo.
const MENSAGENS = {
  nome: "Escreva seu nome, só com letras (pelo menos 2).",
  telefone: "Confira o celular: DDD e número, por exemplo (11) 91234-5678.",
  estacao_id: "Escolha um dos bairros da lista.",
  consentimento_lgpd: "Marque a autorização acima para podermos mandar os alertas.",
};

export const CLASSE_CAMPO =
  "min-h-13 w-full rounded-md border border-borda-forte bg-noite px-4 text-lg text-texto placeholder:text-texto-3 hover:border-texto-3 aria-[invalid=true]:border-emergencia";

/** Rótulo em cima, erro embaixo, ligados ao campo por id: o leitor de tela lê os três juntos. */
function Campo({ id, rotulo, obrigatorio, erro, dica, children }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="font-semibold">
        {rotulo}
        {obrigatorio && <span className="font-normal text-texto-3"> (obrigatório)</span>}
      </label>
      {dica && <p className="m-0 text-texto-3" id={`${id}-dica`}>{dica}</p>}
      {children}
      {erro && <p className="m-0 font-semibold text-emergencia" id={`${id}-erro`}>{erro}</p>}
    </div>
  );
}

function Opcao({ children, className, ...input }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-md border border-borda bg-noite px-4 py-3 has-[:checked]:border-linha", className)}>
      <input {...input} className="mt-1 size-5 shrink-0 accent-[var(--linha)]" />
      <span className="text-lg">{children}</span>
    </label>
  );
}

export default function Cadastro() {
  const { dados: estacoes } = useDados("/api/estacoes");
  const [form, setForm] = useState(VAZIO);
  const [resultado, setResultado] = useState(null);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [telSair, setTelSair] = useState("");
  const [msgSair, setMsgSair] = useState(null);
  const confirmacao = useRef(null);
  const formulario = useRef(null);

  useEffect(() => {
    if (resultado) confirmacao.current?.focus();
  }, [resultado]);

  const mudar = (campo) => (e) => {
    setForm({ ...form, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
    if (erros[campo]) setErros({ ...erros, [campo]: undefined });
  };
  const descrito = (id, dica) => [dica && `${id}-dica`, erros[id] && `${id}-erro`].filter(Boolean).join(" ") || undefined;

  async function cadastrar(e) {
    e.preventDefault();
    setErros({});
    setErroGeral(null);
    setEnviando(true);
    try {
      setResultado(await enviar("/api/moradores", form));
      setForm(VAZIO);
    } catch (err) {
      const campos = Object.fromEntries(Object.keys(err.campos || {}).map((c) => [c, MENSAGENS[c] || err.campos[c]]));
      if (err.status === 409) {
        setErros({ telefone: "Este celular já está cadastrado. Para trocar o bairro, apague o cadastro abaixo e faça de novo." });
      } else if (Object.keys(campos).length) {
        setErros(campos);
        const primeiro = ORDEM.find((c) => campos[c]);
        if (primeiro) formulario.current?.querySelector(`#${primeiro}`)?.focus();
      } else {
        setErroGeral(err.status ? err.message : "Não foi possível enviar agora. Confira a internet e tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function sair(e) {
    e.preventDefault();
    try {
      const r = await apagar("/api/moradores", { telefone: telSair });
      setMsgSair(r.removido ? "Pronto. Seu telefone foi apagado do sistema." : "Esse telefone não estava cadastrado.");
    } catch (err) {
      setMsgSair(err.campos?.telefone || err.message);
    }
  }

  return (
    <Pagina className="md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
        <h1 className="m-0 text-4xl font-bold md:text-6xl">Receba o aviso antes da água</h1>
        <p className="m-0 text-xl text-texto-2">
          É gratuito. O SMS chega em média uma hora antes de o córrego transbordar, e só nessas horas.
        </p>
        <ul className="m-0 grid list-none gap-3 p-0 text-lg">
          <li className="flex gap-3"><DeviceMobile size={26} className="shrink-0 text-rio" aria-hidden="true" /> SMS funciona em qualquer celular, sem internet.</li>
          <li className="flex gap-3"><ChatCircleText size={26} className="shrink-0 text-rio" aria-hidden="true" /> A mensagem diz o que fazer e qual é o abrigo mais perto.</li>
          <li className="flex gap-3"><LockKey size={26} className="shrink-0 text-rio" aria-hidden="true" /> Seu número fica cifrado e nunca aparece inteiro para ninguém.</li>
        </ul>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
        {resultado ? (
          <Card className="risco-normal flex items-start gap-4 border-transparent bg-risco-fundo" role="status">
            <CheckCircle size={44} weight="fill" className="shrink-0 text-risco" aria-hidden="true" />
            <div>
              <h2 tabIndex={-1} ref={confirmacao} className="m-0 text-2xl font-bold outline-none">
                Cadastro feito, {resultado.nome.split(" ")[0]}.
              </h2>
              <p className="mt-2 mb-4 text-lg">
                Os alertas de <strong>{resultado.bairro}</strong> vão chegar no {resultado.telefone} por{" "}
                {resultado.canal === "sms" ? "SMS" : "WhatsApp"}.
              </p>
              <Button variant="contorno" onClick={() => setResultado(null)}>Cadastrar outra pessoa</Button>
            </div>
          </Card>
        ) : (
          <Card>
            <form className="grid gap-5" onSubmit={cadastrar} noValidate ref={formulario}>
              <Campo id="nome" rotulo="Nome" obrigatorio erro={erros.nome}>
                <input id="nome" className={CLASSE_CAMPO} value={form.nome} onChange={mudar("nome")} autoComplete="name" maxLength={80}
                  aria-required="true" aria-invalid={!!erros.nome} aria-describedby={descrito("nome")} />
              </Campo>
              <Campo id="telefone" rotulo="Celular com DDD" obrigatorio erro={erros.telefone} dica="Exemplo: (11) 91234-5678">
                <input id="telefone" className={CLASSE_CAMPO} value={form.telefone} onChange={mudar("telefone")} inputMode="tel" autoComplete="tel"
                  aria-required="true" aria-invalid={!!erros.telefone} aria-describedby={descrito("telefone", true)} />
              </Campo>
              <Campo id="estacao_id" rotulo="Bairro" erro={erros.estacao_id}>
                <div className="relative">
                  <select id="estacao_id" className={cn(CLASSE_CAMPO, "appearance-none pr-11")} value={form.estacao_id} onChange={mudar("estacao_id")}
                    aria-invalid={!!erros.estacao_id} aria-describedby={descrito("estacao_id")}>
                    {(estacoes || []).map((e) => <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>)}
                  </select>
                  <CaretDown size={18} weight="bold" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-texto-2" aria-hidden="true" />
                </div>
              </Campo>
              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-2 font-semibold">Como prefere receber</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Opcao type="radio" name="canal" value="sms" checked={form.canal === "sms"} onChange={mudar("canal")}>
                    SMS <span className="text-texto-3">(sem internet)</span>
                  </Opcao>
                  <Opcao type="radio" name="canal" value="whatsapp" checked={form.canal === "whatsapp"} onChange={mudar("canal")}>
                    WhatsApp
                  </Opcao>
                </div>
              </fieldset>
              <Opcao type="checkbox" checked={form.mobilidade_reduzida} onChange={mudar("mobilidade_reduzida")}>
                Na minha casa mora alguém com dificuldade para andar (idoso, cadeirante, acamado)
              </Opcao>
              <div className={cn("grid gap-2 rounded-md bg-superficie-2 p-4", erros.consentimento_lgpd && "ring-2 ring-emergencia")}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input id="consentimento_lgpd" type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--linha)]" checked={form.consentimento_lgpd}
                    onChange={mudar("consentimento_lgpd")} aria-required="true" aria-invalid={!!erros.consentimento_lgpd}
                    aria-describedby={["lgpd-texto", erros.consentimento_lgpd && "consentimento_lgpd-erro"].filter(Boolean).join(" ")} />
                  <span className="text-lg">
                    Autorizo o uso do meu telefone <strong>só</strong> para receber alertas de enchente.
                    <span className="text-texto-3"> (obrigatório)</span>
                  </span>
                </label>
                <p className="m-0 pl-8 text-sm text-texto-3" id="lgpd-texto">
                  Você pode apagar o cadastro quando quiser, logo abaixo (LGPD, art. 18).{" "}
                  <Link to="/privacidade" className="underline">Como usamos os seus dados</Link>.
                </p>
                {erros.consentimento_lgpd && (
                  <p className="m-0 pl-8 font-semibold text-emergencia" id="consentimento_lgpd-erro">{erros.consentimento_lgpd}</p>
                )}
              </div>
              {erroGeral && <p className="m-0 font-semibold text-emergencia" role="alert">{erroGeral}</p>}
              <Button variant="alerta" className="w-full sm:w-auto sm:justify-self-start" disabled={enviando}>
                {enviando ? "Enviando…" : "Quero receber os alertas"}
              </Button>
            </form>
          </Card>
        )}

        <details className="group rounded-lg border border-borda bg-superficie p-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
            Não quero mais receber alertas
            <CaretDown size={18} weight="bold" className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <form onSubmit={sair} className="mt-4 grid gap-3">
            <label htmlFor="tel-sair" className="font-semibold">Celular cadastrado</label>
            <input id="tel-sair" className={CLASSE_CAMPO} value={telSair} onChange={(e) => setTelSair(e.target.value)} inputMode="tel" autoComplete="tel" />
            <Button variant="contorno" className="justify-self-start">Apagar meu cadastro</Button>
            {msgSair && <p className="m-0" role="status">{msgSair}</p>}
          </form>
        </details>
      </div>
    </Pagina>
  );
}
