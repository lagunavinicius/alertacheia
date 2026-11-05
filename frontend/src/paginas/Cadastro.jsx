import { useState } from "react";
import { apagar, enviar } from "../api.js";
import { useDados } from "../comum.jsx";

const VAZIO = { nome: "", telefone: "", estacao_id: "EST-03", mobilidade_reduzida: false, canal: "sms", consentimento_lgpd: false };

export default function Cadastro() {
  const { dados: estacoes } = useDados("/api/estacoes");
  const [form, setForm] = useState(VAZIO);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [telSair, setTelSair] = useState("");
  const [msgSair, setMsgSair] = useState(null);

  const mudar = (campo) => (e) =>
    setForm({ ...form, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function cadastrar(e) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      setResultado(await enviar("/api/moradores", form));
      setForm(VAZIO);
    } catch (err) {
      setErro(err.message);
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
      setMsgSair(err.message);
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
          <h2>Cadastro feito, {resultado.nome.split(" ")[0]}!</h2>
          <p>
            Os alertas de <strong>{resultado.bairro}</strong> vão chegar no {resultado.telefone} por{" "}
            {resultado.canal === "sms" ? "SMS" : "WhatsApp"}.
          </p>
          <button type="button" className="botao botao-secundario" onClick={() => setResultado(null)}>
            Cadastrar outra pessoa
          </button>
        </section>
      ) : (
        <form className="cartao formulario" onSubmit={cadastrar} noValidate>
          <label>
            Nome
            <input value={form.nome} onChange={mudar("nome")} autoComplete="name" required maxLength={80} />
          </label>
          <label>
            Celular com DDD
            <input value={form.telefone} onChange={mudar("telefone")} inputMode="tel" autoComplete="tel"
              placeholder="(11) 91234-5678" required />
          </label>
          <label>
            Bairro
            <select value={form.estacao_id} onChange={mudar("estacao_id")}>
              {(estacoes || []).map((e) => (
                <option key={e.estacao_id} value={e.estacao_id}>{e.bairro}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Como prefere receber</legend>
            <label className="opcao">
              <input type="radio" name="canal" value="sms" checked={form.canal === "sms"} onChange={mudar("canal")} />
              <span>SMS <span className="cinza">(funciona sem internet)</span></span>
            </label>
            <label className="opcao">
              <input type="radio" name="canal" value="whatsapp" checked={form.canal === "whatsapp"} onChange={mudar("canal")} /> WhatsApp
            </label>
          </fieldset>
          <label className="opcao">
            <input type="checkbox" checked={form.mobilidade_reduzida} onChange={mudar("mobilidade_reduzida")} />
            Na minha casa mora alguém com dificuldade para andar (idoso, cadeirante, acamado)
          </label>
          <div className="lgpd">
            <label className="opcao">
              <input type="checkbox" checked={form.consentimento_lgpd} onChange={mudar("consentimento_lgpd")} required />
              <span>Autorizo o uso do meu telefone <strong>só</strong> para receber alertas de enchente.</span>
            </label>
            <p className="pequeno cinza">
              Seu número fica guardado de forma cifrada e nunca aparece inteiro para ninguém, nem para a Defesa Civil.
              Você pode apagar o cadastro quando quiser, logo abaixo (LGPD, art. 18).
            </p>
          </div>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="botao" disabled={enviando}>{enviando ? "Enviando…" : "Quero receber os alertas"}</button>
        </form>
      )}

      <details className="cartao sair">
        <summary>Não quero mais receber alertas</summary>
        <form onSubmit={sair} className="formulario">
          <label>
            Celular cadastrado
            <input value={telSair} onChange={(e) => setTelSair(e.target.value)} inputMode="tel" />
          </label>
          <button className="botao botao-secundario">Apagar meu cadastro</button>
          {msgSair && <p role="status">{msgSair}</p>}
        </form>
      </details>
    </div>
  );
}
