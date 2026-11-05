import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { enviar, salvarToken } from "../api.js";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const navegar = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro(null);
    try {
      const r = await enviar("/api/auth/login", { usuario, senha });
      salvarToken(r.token);
      navegar("/painel");
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="pagina pagina-estreita">
      <h1>Painel da Defesa Civil</h1>
      <p className="subtitulo">Acesso restrito a operadores. A sessão expira em 1 hora.</p>
      <form className="cartao formulario" onSubmit={entrar}>
        <label>
          Usuário
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao">Entrar</button>
      </form>
    </div>
  );
}
