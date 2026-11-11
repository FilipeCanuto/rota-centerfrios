/** Tela "pai" para onde o Voltar leva quando não há histórico do app (acesso direto pelo endereço). */
export function rotaPai(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/redefinir-senha") return "/auth";
  if (p.startsWith("/configuracoes/")) return "/mais";
  const [, primeiro, resto] = p.split("/");
  if (primeiro && resto) return `/${primeiro}`; // ex.: /clientes/123 → /clientes
  return "/inicio";
}
