import type { Link } from "./dados";

export type FiltroPublico = "todos" | "cliente" | "interno";

/** Só links marcados como "cliente" podem ir ao cliente; qualquer outro valor é tratado como interno. */
export function podeEnviarAoCliente(link: Pick<Link, "publico">) {
  return link.publico === "cliente";
}

export function filtrarLinks(links: Link[], filtro: FiltroPublico, busca: string) {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = links.filter((l) => {
    if (filtro !== "todos" && (podeEnviarAoCliente(l) ? "cliente" : "interno") !== filtro)
      return false;
    if (!termo) return true;
    return `${l.titulo} ${l.descricao ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo);
  });
  return {
    cliente: filtrados.filter(podeEnviarAoCliente),
    interno: filtrados.filter((l) => !podeEnviarAoCliente(l)),
  };
}
