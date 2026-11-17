import { describe, expect, it } from "vitest";
import { canalSimulado, CONEXOES } from "./conexoes";

describe("canalSimulado", () => {
  it("envia sem sair da Rota e recusa destinatário vazio", async () => {
    const c = canalSimulado("teste");
    expect(c.modo).toBe("simulado");
    expect((await c.enviar("5582999990000", "Oi")).id).toMatch(/^simulado-/);
    await expect(c.enviar(" ", "Oi")).rejects.toThrow();
  });
  it("devolve só as recebidas depois do instante pedido", async () => {
    const c = canalSimulado("teste");
    c.simularRecebida({ id: "1", de: "a", texto: "x", em: "2026-11-17T10:00:00Z" });
    c.simularRecebida({ id: "2", de: "a", texto: "y", em: "2026-11-17T12:00:00Z" });
    expect((await c.recebidas("2026-11-17T11:00:00Z")).map((m) => m.id)).toEqual(["2"]);
  });
});

describe("CONEXOES", () => {
  it("lista só nomes de Secrets, em maiúsculas, e o que falta", () => {
    for (const c of CONEXOES) {
      expect(c.segredos.every((s) => /^[A-Z_]+$/.test(s))).toBe(true);
      expect(c.falta.length).toBeGreaterThan(0);
    }
  });
});
