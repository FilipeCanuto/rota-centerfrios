import { describe, expect, it } from "vitest";
import { normalizarTelefone } from "./manual";

describe("normalizarTelefone", () => {
  it("acrescenta 55 em número nacional", () =>
    expect(normalizarTelefone("(82) 99999-0000")).toBe("5582999990000"));
  it("não duplica o 55 quando o número já tem DDI", () =>
    expect(normalizarTelefone("+55 82 99999-0000")).toBe("5582999990000"));
  it("DDD 55 (RS) sem DDI recebe o 55", () =>
    expect(normalizarTelefone("55 99999-0000")).toBe("5555999990000"));
  it("vazio continua vazio", () => expect(normalizarTelefone("")).toBe(""));
});
