import { describe, expect, it } from "vitest";
import {
  chavePublicaValida,
  codigoPareamentoValido,
  conectorOnline,
  criarLimitador,
  prechecar,
  verificarAssinatura,
} from "./conector";

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
      "cabecalhos",
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

  it("na troca de chave aceita a anterior junto com a nova, e só elas", async () => {
    const nova = "B".repeat(43);
    expect(await verificarAssinatura([nova, PUBLICA], base, agora)).toBeNull();
    expect(await verificarAssinatura([nova], base, agora)).toBe("assinatura");
    expect(await verificarAssinatura([], base, agora)).toBe("assinatura");
  });

  it("pré-checagem barata recusa antes do banco", () => {
    expect(prechecar(base, agora)).toBeNull();
    expect(prechecar({ ...base, assinatura: "curta" }, agora)).toBe("cabecalhos");
    expect(prechecar({ ...base, ts: "abc" }, agora)).toBe("horario");
    expect(prechecar(base, agora + 10 * 60_000)).toBe("horario");
  });

  it("limite de taxa em memória por chave, com janela deslizante", () => {
    const pode = criarLimitador(2, 1000);
    expect(pode("a", 0)).toBe(true);
    expect(pode("a", 10)).toBe(true);
    expect(pode("a", 20)).toBe(false);
    expect(pode("b", 20)).toBe(true);
    expect(pode("a", 1001)).toBe(true);
  });

  it("código de pareamento: 8 caracteres sem ambíguos, aceita minúsculas e hífen", () => {
    expect(codigoPareamentoValido("K7QX-M2PA")).toBe(true);
    expect(codigoPareamentoValido("k7qxm2pa")).toBe(true);
    expect(codigoPareamentoValido("K7QXM2P0")).toBe(false);
    expect(codigoPareamentoValido("K7QXM2P")).toBe(false);
  });
});
