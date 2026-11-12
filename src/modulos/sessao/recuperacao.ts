import { redirect } from "@tanstack/react-router";
import { ehLinkDeAcesso, linkExpirado } from "@/regras";

/**
 * O link do e-mail pode cair em qualquer página (se o endereço não estiver na lista de URLs
 * permitidas, o Supabase usa a página inicial). Leva o link para "Crie sua senha" e o erro de link
 * vencido para o login, sempre com o que vem depois do #. Só funciona em rotas `ssr: false`: o
 * endereço com # nunca chega ao servidor.
 */
export function levarLinkDeRecuperacao(rotaAtual: string) {
  if (typeof window === "undefined") return;
  const { search, hash } = window.location;
  if (rotaAtual !== "/redefinir-senha" && ehLinkDeAcesso(search, hash))
    throw redirect({ to: "/redefinir-senha", hash: hash.slice(1) });
  if (rotaAtual !== "/auth" && linkExpirado(`${search}&${hash}`))
    throw redirect({ to: "/auth", hash: hash.slice(1) });
}

/**
 * A tela "Crie sua senha" só aceita quem chegou por um link do e-mail. A marca fica na aba,
 * para que recarregar a página não feche a tela antes de salvar.
 */
const MARCA = "rota-criar-senha";
export function marcarChegadaPorLink() {
  try {
    sessionStorage.setItem(MARCA, "1");
  } catch {
    // navegação privada sem armazenamento: vale só o endereço atual
  }
}
export function chegouPorLink(): boolean {
  try {
    return sessionStorage.getItem(MARCA) === "1";
  } catch {
    return false;
  }
}
export function esquecerChegadaPorLink() {
  try {
    sessionStorage.removeItem(MARCA);
  } catch {
    // sem armazenamento: nada a apagar
  }
}
