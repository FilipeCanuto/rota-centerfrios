import { describe, expect, it } from "vitest";
import { assinar, conectorOnline, sha256Hex, textoCanonico, verificarAssinatura } from "./conector";

// Mesmo vetor de conector-shop9/test/assinatura.test.js: os dois lados assinam igual.
const HASH = "20fd0ba9f641280a22f72a1145a0892b225fb0b2fdd75a53ba4f83f4596c72ae";
const ASSINATURA = "7e5c9d6a074633f9f3adcb73252742b69b07129fd9737c0298515c22ee37f55d";
const TS = "1700000000000";
const NONCE = "nonce-0123456789abcdef";
const base = {
  ts: TS,
  nonce: NONCE,
  assinatura: ASSINATURA,
  metodo: "POST",
  caminho: "/api/conector/heartbeat",
  corpo: "{}",
};

describe("assinatura do conector", () => {
  it("bate com o vetor fixo", async () => {
    expect(await sha256Hex("token-de-teste")).toBe(HASH);
    const can = await textoCanonico(TS, NONCE, "post", "/api/conector/heartbeat", "{}");
    expect(await assinar(HASH, can)).toBe(ASSINATURA);
  });

  it("aceita assinatura válida dentro da janela", async () => {
    expect(await verificarAssinatura(HASH, base, Number(TS) + 60_000)).toBeNull();
  });

  it("recusa corpo, caminho ou chave alterados", async () => {
    const agora = Number(TS);
    expect(await verificarAssinatura(HASH, { ...base, corpo: '{"a":1}' }, agora)).toBe(
      "assinatura",
    );
    expect(
      await verificarAssinatura(HASH, { ...base, caminho: "/api/conector/resultado" }, agora),
    ).toBe("assinatura");
    expect(await verificarAssinatura("0".repeat(64), base, agora)).toBe("assinatura");
  });

  it("recusa horário fora da janela (repetição tardia)", async () => {
    expect(await verificarAssinatura(HASH, base, Number(TS) + 6 * 60_000)).toBe("horario");
    expect(await verificarAssinatura(HASH, base, Number(TS) - 6 * 60_000)).toBe("horario");
  });

  it("online só com contato nos últimos 3 minutos", () => {
    const agora = Date.parse("2026-11-16T12:00:00Z");
    expect(conectorOnline("2026-11-16T11:58:00Z", agora)).toBe(true);
    expect(conectorOnline("2026-11-16T11:56:00Z", agora)).toBe(false);
    expect(conectorOnline(null, agora)).toBe(false);
  });

  it("recusa cabeçalhos ausentes ou nonce curto", async () => {
    expect(await verificarAssinatura(HASH, { ...base, nonce: "curto" }, Number(TS))).toBe(
      "cabecalhos",
    );
    expect(await verificarAssinatura(HASH, { ...base, assinatura: null }, Number(TS))).toBe(
      "cabecalhos",
    );
  });
});
