import { describe, expect, it } from "vitest";
import { rotaPai } from "./rotas";

describe("rotaPai", () => {
  it("ficha volta para a lista", () => expect(rotaPai("/clientes/abc")).toBe("/clientes"));
  it("configurações voltam para Mais", () => {
    expect(rotaPai("/configuracoes/feriados")).toBe("/mais");
    expect(rotaPai("/configuracoes/importacao/")).toBe("/mais");
  });
  it("nova senha volta para o login", () => expect(rotaPai("/redefinir-senha")).toBe("/auth"));
  it("telas de primeiro nível e desconhecidas voltam para o Início", () => {
    expect(rotaPai("/agenda")).toBe("/inicio");
    expect(rotaPai("/qualquer-coisa")).toBe("/inicio");
  });
});
