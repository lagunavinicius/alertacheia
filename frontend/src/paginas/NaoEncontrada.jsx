import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { Pagina } from "../comum.jsx";

const CAMINHOS = [
  { para: "/", texto: "Ver o risco no meu bairro" },
  { para: "/alertas", texto: "Ver os alertas emitidos" },
  { para: "/cadastro", texto: "Receber alertas no celular" },
];

export default function NaoEncontrada() {
  return (
    <Pagina className="max-w-xl">
      <div className="numero text-[7rem] text-texto-3" aria-hidden="true">404</div>
      <h1 className="m-0 text-4xl font-bold">Esta página não existe</h1>
      <p className="m-0 text-lg text-texto-2">O endereço pode ter mudado. Estes caminhos levam ao que importa:</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {CAMINHOS.map((c) => (
          <li key={c.para}>
            <Link to={c.para} className="flex min-h-14 items-center justify-between rounded-md border border-borda bg-superficie px-5 text-lg font-semibold no-underline hover:border-borda-forte">
              {c.texto} <ArrowRight size={20} weight="bold" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="m-0 text-lg">Em perigo, não espere: ligue <a href="tel:199" className="font-bold">199</a>.</p>
    </Pagina>
  );
}
