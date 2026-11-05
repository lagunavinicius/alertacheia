// Cliente da API. Toda resposta GET bem-sucedida fica guardada no aparelho:
// se a internet cair no meio do temporal, a tela continua mostrando o último
// estado conhecido, com o horário, em vez de uma página em branco.

const CACHE = "alertacheia:cache:";

export function tokenAtual() {
  return sessionStorage.getItem("alertacheia:token");
}

export function salvarToken(token) {
  if (token) sessionStorage.setItem("alertacheia:token", token);
  else sessionStorage.removeItem("alertacheia:token");
}

async function requisitar(caminho, { metodo = "GET", corpo, autenticado = false } = {}) {
  const cabecalhos = { "Content-Type": "application/json" };
  if (autenticado && tokenAtual()) cabecalhos.Authorization = `Bearer ${tokenAtual()}`;
  const resp = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(mensagemDeErro(dados.detail) || `erro ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

function mensagemDeErro(detalhe) {
  if (!detalhe) return null;
  if (typeof detalhe === "string") return detalhe;
  if (Array.isArray(detalhe)) return detalhe.map((d) => d.msg.replace("Value error, ", "")).join(" · ");
  return null;
}

export async function obter(caminho, opcoes = {}) {
  try {
    const dados = await requisitar(caminho, opcoes);
    if (!opcoes.autenticado) {
      localStorage.setItem(CACHE + caminho, JSON.stringify({ dados, em: Date.now() }));
    }
    return { dados, offline: false };
  } catch (erro) {
    const guardado = localStorage.getItem(CACHE + caminho);
    if (guardado && !erro.status) {
      const { dados, em } = JSON.parse(guardado);
      return { dados, offline: true, guardadoEm: em };
    }
    throw erro;
  }
}

export const enviar = (caminho, corpo, autenticado = false) =>
  requisitar(caminho, { metodo: "POST", corpo, autenticado });

export const apagar = (caminho, corpo) => requisitar(caminho, { metodo: "DELETE", corpo });
