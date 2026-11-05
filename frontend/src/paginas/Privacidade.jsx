import { Link } from "react-router-dom";
import { Pagina } from "../comum.jsx";

// O texto descreve exatamente o que o código faz (api/seguranca.py e api/main.py).
// Se o tratamento de dados mudar, este texto muda junto.
export default function Privacidade() {
  return (
    <Pagina className="max-w-3xl [&_h2]:mt-4 [&_h2]:mb-0 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:text-lg [&_p]:my-0 [&_p]:max-w-[65ch] [&_p]:text-lg [&_ul]:m-0 [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-6">
      <h1 className="m-0 text-4xl font-bold md:text-5xl">Como usamos os seus dados</h1>
      <p className="!text-xl text-texto-2">
        Versão curta: guardamos só o necessário para avisar você de enchente, e você pode apagar tudo quando quiser.
      </p>

      <h2>O que guardamos</h2>
      <ul>
        <li>Seu nome e o número do celular.</li>
        <li>O bairro de que você quer receber alertas.</li>
        <li>Se na casa mora alguém com dificuldade para andar, para o alerta trazer uma orientação a mais.</li>
        <li>Se prefere SMS ou WhatsApp, e o dia em que você autorizou o cadastro.</li>
      </ul>

      <h2>Para que usamos</h2>
      <p>
        Só para mandar alertas de enchente do seu bairro. Não usamos para propaganda, não vendemos e não passamos para
        outras empresas. A base legal é o seu consentimento (LGPD, art. 7º, inciso I), que você dá ao marcar a
        autorização no cadastro.
      </p>

      <h2>Como protegemos</h2>
      <ul>
        <li>O número do celular fica guardado cifrado. Ele só é aberto na hora de enviar o SMS.</li>
        <li>Em todas as telas, inclusive no painel da Defesa Civil, o número aparece escondido: só os 4 últimos dígitos.</li>
        <li>As leituras dos sensores e os gráficos não têm nenhum dado pessoal.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        Você pode apagar o seu cadastro a qualquer momento, sem precisar falar com ninguém: use{" "}
        <Link to="/cadastro" className="underline">"Não quero mais receber alertas"</Link> na tela de cadastro. O cadastro é removido na hora
        (LGPD, art. 18).
      </p>

      <p className="mt-4 rounded-md border border-borda bg-superficie px-5 py-4 text-texto-2">
        O AlertaCheia é um protótipo acadêmico (Global Solution 2026/2, FIAP). Os SMS são simulados e nenhuma mensagem
        sai de verdade.
      </p>
    </Pagina>
  );
}
