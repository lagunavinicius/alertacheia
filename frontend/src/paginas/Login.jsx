import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import { enviar, salvarToken } from "../api.js";
import { Pagina } from "../comum.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CLASSE_CAMPO } from "./Cadastro.jsx";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const navegar = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      const r = await enviar("/api/auth/login", { usuario, senha });
      salvarToken(r.token);
      navegar("/painel");
    } catch (err) {
      setErro(err.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : err.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Pagina className="max-w-md">
      <ShieldCheck size={44} className="text-rio" aria-hidden="true" />
      <h1 className="m-0 text-4xl font-bold">Painel da Defesa Civil</h1>
      <p className="-mt-2 mb-0 text-lg text-texto-2">Acesso restrito a operadores. A sessão expira em 1 hora.</p>
      <Card>
        <form className="grid gap-5" onSubmit={entrar}>
          <div className="grid gap-2">
            <label htmlFor="usuario" className="font-semibold">Usuário</label>
            <input id="usuario" className={CLASSE_CAMPO} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
          </div>
          <div className="grid gap-2">
            <label htmlFor="senha" className="font-semibold">Senha</label>
            <input id="senha" type="password" className={CLASSE_CAMPO} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          </div>
          {erro && <p className="m-0 font-semibold text-emergencia" role="alert">{erro}</p>}
          <Button disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</Button>
        </form>
      </Card>
    </Pagina>
  );
}
