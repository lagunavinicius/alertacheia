import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";

export default function NaoEncontrada() {
  return (
    <div className="pagina pagina-estreita nao-encontrada">
      <h1>Esta página não existe</h1>
      <p className="subtitulo">O endereço pode ter mudado. Estes caminhos levam ao que importa:</p>
      <ul className="caminhos">
        <li><Link to="/">Ver o risco no meu bairro <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link></li>
        <li><Link to="/alertas">Ver os alertas emitidos <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link></li>
        <li><Link to="/cadastro">Receber alertas no celular <ArrowRight size={18} weight="bold" aria-hidden="true" /></Link></li>
      </ul>
      <p>Em perigo, não espere: ligue <a href="tel:199"><strong>199</strong></a>.</p>
    </div>
  );
}
