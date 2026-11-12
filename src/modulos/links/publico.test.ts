import { describe, expect, it } from "vitest";
import type { Link } from "./dados";
import { filtrarLinks, podeEnviarAoCliente } from "./publico";

const base = {
  empresa_id: null,
  descricao: null,
  url: "https://a",
  arquivo_path: null,
  mensagem_whatsapp: null,
  ordem: 0,
  ativo: true,
};
const links: Link[] = [
  { ...base, id: "1", titulo: "Catálogo", publico: "cliente" },
  { ...base, id: "2", titulo: "Tabela interna", publico: "interno" },
  { ...base, id: "3", titulo: "Estranho", publico: "outro" },
];

describe("público dos links", () => {
  it("só 'cliente' pode ser enviado ao cliente", () => {
    expect(podeEnviarAoCliente({ publico: "cliente" })).toBe(true);
    expect(podeEnviarAoCliente({ publico: "interno" })).toBe(false);
    expect(podeEnviarAoCliente({ publico: "outro" })).toBe(false);
  });
  it("separa em duas seções e valor desconhecido vira interno", () => {
    const r = filtrarLinks(links, "todos", "");
    expect(r.cliente.map((l) => l.id)).toEqual(["1"]);
    expect(r.interno.map((l) => l.id)).toEqual(["2", "3"]);
  });
  it("filtro e busca combinados", () => {
    expect(filtrarLinks(links, "interno", "").cliente).toHaveLength(0);
    expect(filtrarLinks(links, "cliente", "").interno).toHaveLength(0);
    expect(filtrarLinks(links, "todos", "tabela").interno.map((l) => l.id)).toEqual(["2"]);
  });
});
