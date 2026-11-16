import { describe, expect, it } from "vitest";
import { chavePublicaValida, conectorOnline, verificarAssinatura } from "./conector";

// Mesmo vetor de conector-shop9/test/conector.test.js (chave gerada da semente 0x07 × 32).
const PUBLICA = "6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw";
const ASSINATURA =
  "dYSqeaWIhAGH3azVRxIragH2nNd5BoH3LwtDtgx-8CAbIQLZF0WFJiA1RUuV1eDTeEwLkcnGsrbOuYN0E1wbAA";
const TS = "1700000000000";
const base = {
  ts: TS,
  nonce: "nonce-0123456789abcdef",
  assinatura: ASSINATURA,
  metodo: "POST",
  caminho: "/api/conector/heartbeat",
  corpo: "{}",
};
const agora = Number(TS);

describe("assinatura Ed25519 do conector", () => {
  it("aceita o vetor fixo dentro da janela", async () => {
    expect(await verificarAssinatura(PUBLICA, base, agora + 60_000)).toBeNull();
  });

  it("recusa corpo, caminho ou chave pública diferentes", async () => {
    expect(await verificarAssinatura(PUBLICA, { ...base, corpo: '{"a":1}' }, agora)).toBe(
      "assinatura",
    );
    expect(
      await verificarAssinatura(PUBLICA, { ...base, caminho: "/api/conector/resultado" }, agora),
    ).toBe("assinatura");
    const outra = "A".repeat(43);
    expect(await verificarAssinatura(outra, base, agora)).toBe("assinatura");
    expect(await verificarAssinatura(PUBLICA, { ...base, assinatura: "x$y" }, agora)).toBe(
      "assinatura",
    );
  });

  it("recusa horário fora da janela (repetição tardia)", async () => {
    expect(await verificarAssinatura(PUBLICA, base, agora + 6 * 60_000)).toBe("horario");
    expect(await verificarAssinatura(PUBLICA, base, agora - 6 * 60_000)).toBe("horario");
  });

  it("recusa cabeçalhos ausentes ou nonce curto", async () => {
    expect(await verificarAssinatura(PUBLICA, { ...base, nonce: "curto" }, agora)).toBe(
      "cabecalhos",
    );
    expect(await verificarAssinatura(PUBLICA, { ...base, assinatura: null }, agora)).toBe(
      "cabecalhos",
    );
  });

  it("valida o formato da chave pública colada na tela", () => {
    expect(chavePublicaValida(PUBLICA)).toBe(true);
    expect(chavePublicaValida(` ${PUBLICA}\n`)).toBe(true);
    expect(chavePublicaValida("abc")).toBe(false);
    expect(chavePublicaValida("-----BEGIN PUBLIC KEY-----")).toBe(false);
  });

  it("online só com contato nos últimos 3 minutos", () => {
    const t = Date.parse("2026-11-16T12:00:00Z");
    expect(conectorOnline("2026-11-16T11:58:00Z", t)).toBe(true);
    expect(conectorOnline("2026-11-16T11:56:00Z", t)).toBe(false);
    expect(conectorOnline(null, t)).toBe(false);
  });
});
