import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";
import { apagar, enviar } from "../api.js";
import { useDados } from "../comum.jsx";

const VAZIO = { nome: "", telefone: "", estacao_id: "EST-03", mobilidade_reduzida: false, canal: "sms", consentimento_lgpd: false };
const ORDEM = ["nome", "telefone", "estacao_id", "consentimento_lgpd"];
// A API valida; a tela explica em português simples o que fazer em cada campo.
const MENSAGENS = {
  nome: "Escreva seu nome, só com letras (pelo menos 2).",
  telefone: "Confira o celular: DDD e número, por exemplo (11) 91234-5678.",
  estacao_id: "Escolha um dos bairros da lista.",
  consentimento_lgpd: "Marque a autorização acima para podermos mandar os alertas.",
};

/** Rótulo em cima, erro embaixo, ligados ao campo por id: o leitor de tela lê os três juntos. */
function Campo({ id, rotulo, obrigatorio, erro, dica, children }) {
  return (
    <div className={`campo ${erro ? "campo-erro" : ""}`}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="obrigatorio"> (obrigatório)</span>}
      </label>
      {dica && <p className="dica" id={`${id}-dica`}>{dica}</p>}
      {children}
      {erro && <p className="erro-campo" id={`${id}-erro`}>{erro}</p>}
    </div>
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
        // leva o foco para o primeiro campo com problema
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
    <div className="pagina pagina-estreita">
      <h1>Receber alertas no celular</h1>
      <p className="subtitulo">
        É gratuito. Você recebe o aviso do seu bairro quando houver risco de enchente, e só nessas horas.
      </p>

      {resultado ? (
        <section className="cartao confirmacao" role="status">
          <CheckCircle size={40} weight="fill" className="confirmacao-icone" aria-hidden="true" />
          <div>
            <h2 tabIndex={-1} ref={confirmacao}>Cadastro feito, {resultado.nome.split(" ")[0]}.</h2>
            <p>
              Os alertas de <strong>{resultado.bairro}</strong> vão chegar no {resultado.telefone} por{" "}
              {resultado.canal === "sms" ? "SMS" : "WhatsApp"}.
            </p>
            <button type="button" className="botao botao-secundario" onClick={() => setResultado(null)}>
              Cadastrar outra pessoa
            </button>
          </div>
        </section>
      ) : (
        <form className="cartao formulario" onSubmit={cadastrar} noValidate ref={formulario}>
          <Campo id="nome" rotulo="Nome" obrigatorio erro={erros.nome}>
            <input id="nome" value={form.nome} onChange={mudar("nome")} autoComplete="name" maxLength={80}
              aria-required="true" aria-invalid={!!erros.nome} aria-describedby={descrito("nome")} />
          </Campo>
          <Campo id="telefone" rotulo="Celular com DDD" obrigatorio erro={erros.telefone} dica="Exemplo: (11) 91234-5678">
            <input id="telefone" value={form.telefone} onChange={mudar("telefone")} inputMode="tel" autoComplete="tel"
              aria-required="true" aria-invalid={!!erros.telefone} aria-describedby={descrito("telefone", true)} />
          </Campo>
          <Campo id="estacao_id" rotulo="Bairro" erro={erros.estacao_id}>
            <select id="estacao_id" value={form.estacao_id} onChange={mudar("estacao_id")}
              aria-invalid={!!erros.estacao_id} aria-describedby={descrito("estacao_id")}>
              {(estacoes || []).map((e) => (
                <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>
              ))}
            </select>
          </Campo>
          <fieldset>
            <legend>Como prefere receber</legend>
            <label className="opcao">
              <input type="radio" name="canal" value="sms" checked={form.canal === "sms"} onChange={mudar("canal")} />
              <span>SMS <span className="cinza">(funciona sem internet)</span></span>
            </label>
            <label className="opcao">
              <input type="radio" name="canal" value="whatsapp" checked={form.canal === "whatsapp"} onChange={mudar("canal")} />
              <span>WhatsApp</span>
            </label>
          </fieldset>
          <label className="opcao">
            <input type="checkbox" checked={form.mobilidade_reduzida} onChange={mudar("mobilidade_reduzida")} />
            <span>Na minha casa mora alguém com dificuldade para andar (idoso, cadeirante, acamado)</span>
          </label>
          <div className={`lgpd ${erros.consentimento_lgpd ? "campo-erro" : ""}`}>
            <label className="opcao">
              <input id="consentimento_lgpd" type="checkbox" checked={form.consentimento_lgpd}
                onChange={mudar("consentimento_lgpd")} aria-required="true" aria-invalid={!!erros.consentimento_lgpd}
                aria-describedby={["lgpd-texto", erros.consentimento_lgpd && "consentimento_lgpd-erro"].filter(Boolean).join(" ")} />
              <span>Autorizo o uso do meu telefone <strong>só</strong> para receber alertas de enchente.
                <span className="obrigatorio"> (obrigatório)</span></span>
            </label>
            <p className="pequeno cinza" id="lgpd-texto">
              Seu número fica guardado de forma cifrada e nunca aparece inteiro para ninguém, nem para a Defesa Civil.
              Você pode apagar o cadastro quando quiser, logo abaixo (LGPD, art. 18).{" "}
              <Link to="/privacidade">Como usamos os seus dados</Link>.
            </p>
            {erros.consentimento_lgpd && (
              <p className="erro-campo" id="consentimento_lgpd-erro">{erros.consentimento_lgpd}</p>
            )}
          </div>
          {erroGeral && <p className="erro" role="alert">{erroGeral}</p>}
          <button className="botao" disabled={enviando}>{enviando ? "Enviando…" : "Quero receber os alertas"}</button>
        </form>
      )}

      <details className="cartao sair">
        <summary>Não quero mais receber alertas</summary>
        <form onSubmit={sair} className="formulario">
          <div className="campo">
            <label htmlFor="tel-sair">Celular cadastrado</label>
            <input id="tel-sair" value={telSair} onChange={(e) => setTelSair(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <button className="botao botao-secundario">Apagar meu cadastro</button>
          {msgSair && <p role="status">{msgSair}</p>}
        </form>
      </details>
    </div>
  );
}
