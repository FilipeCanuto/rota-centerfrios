import { redirect } from "@tanstack/react-router";
import { ehLinkDeRecuperacao } from "@/regras";

/**
 * O link de recuperação de senha pode cair em qualquer página (se o endereço certo não estiver na
 * lista de URLs permitidas, o Supabase usa a página inicial). Leva para a tela de nova senha com o
 * token. Só funciona em rotas `ssr: false`: o endereço com # nunca chega ao servidor.
 */
export function levarLinkDeRecuperacao() {
  if (typeof window === "undefined") return;
  if (ehLinkDeRecuperacao(window.location.search, window.location.hash))
    throw redirect({ to: "/redefinir-senha", hash: window.location.hash.slice(1) });
}
