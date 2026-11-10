import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import { enviar, salvarToken, tokenAtual } from "../api.js";
import { Pagina } from "../comum.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CLASSE_CAMPO } from "./Cadastro.jsx";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [faltando, setFaltando] = useState({});
  const [entrando, setEntrando] = useState(false);
  const navegar = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    // mesmo padrão do cadastro: erro escrito junto do campo, não o balão do navegador
    const falta = { usuario: !usuario.trim(), senha: !senha };
    setFaltando(falta);
    if (falta.usuario || falta.senha) {
      document.getElementById(falta.usuario ? "usuario" : "senha")?.focus();
      return;
    }
    setEntrando(true);
    try {
      const r = await enviar("/api/auth/login", { usuario, senha });
      salvarToken(r.token);
      navegar("/painel");
    } catch (err) {
      const msg = err.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : err.message || "Não foi possível entrar.";
      setErro(msg.charAt(0).toUpperCase() + msg.slice(1));
    } finally {
      setEntrando(false);
    }
  }

  if (tokenAtual()) return <Navigate to="/painel" replace />;

  return (
    <Pagina className="max-w-md">
      <ShieldCheck size={44} className="text-rio" aria-hidden="true" />
      <h1 className="m-0 text-4xl font-bold">Painel da Defesa Civil</h1>
      <p className="-mt-2 mb-0 text-lg text-texto-2">Acesso restrito a operadores. A sessão expira em 1 hora.</p>
      <Card>
        <form className="grid gap-5" onSubmit={entrar} noValidate>
          <div className="grid gap-2">
            <label htmlFor="usuario" className="font-semibold">Usuário</label>
            <input id="usuario" className={CLASSE_CAMPO} value={usuario} onChange={(e) => { setUsuario(e.target.value); setFaltando((f) => ({ ...f, usuario: false })); }}
              autoComplete="username" aria-required="true" aria-invalid={!!faltando.usuario} aria-describedby={faltando.usuario ? "usuario-erro" : undefined} />
            {faltando.usuario && <p className="m-0 font-semibold text-emergencia" id="usuario-erro">Escreva o seu usuário.</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="senha" className="font-semibold">Senha</label>
            <input id="senha" type="password" className={CLASSE_CAMPO} value={senha} onChange={(e) => { setSenha(e.target.value); setFaltando((f) => ({ ...f, senha: false })); }}
              autoComplete="current-password" aria-required="true" aria-invalid={!!faltando.senha} aria-describedby={faltando.senha ? "senha-erro" : undefined} />
            {faltando.senha && <p className="m-0 font-semibold text-emergencia" id="senha-erro">Escreva a sua senha.</p>}
          </div>
          {erro && <p className="m-0 font-semibold text-emergencia" role="alert">{erro}</p>}
          <Button disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</Button>
        </form>
      </Card>
    </Pagina>
  );
}
