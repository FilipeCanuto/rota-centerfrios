import { describe, expect, it } from "vitest";
import { apelidoValido, expressaoDoCopiloto } from "./index";

const c = (p = {}) => ({ atingimento: 0.3, clientesHoje: 0, orcamentosParados: 0, ...p });

describe("copiloto", () => {
  it("meta batida comemora, mesmo com pendências", () => {
    expect(expressaoDoCopiloto(c({ atingimento: 1.2, clientesHoje: 4 }))).toBe("comemorando");
  });
  it("pendências pedem atenção", () => {
    expect(expressaoDoCopiloto(c({ clientesHoje: 2 }))).toBe("atento");
    expect(expressaoDoCopiloto(c({ orcamentosParados: 1 }))).toBe("atento");
  });
  it("em dia: feliz perto da meta, neutro longe", () => {
    expect(expressaoDoCopiloto(c({ atingimento: 0.8 }))).toBe("feliz");
    expect(expressaoDoCopiloto(c())).toBe("neutro");
  });
  it("apelido aceita 2 a 20 caracteres e apara espaços", () => {
    expect(apelidoValido("  Pingo ")).toBe("Pingo");
    expect(apelidoValido("a")).toBeNull();
    expect(apelidoValido("x".repeat(21))).toBeNull();
    expect(apelidoValido("   ")).toBeNull();
  });
});
