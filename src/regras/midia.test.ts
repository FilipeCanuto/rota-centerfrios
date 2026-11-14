import { describe, expect, it } from "vitest";
import {
  limitarFoco,
  moverItem,
  proporcaoDoPalco,
  rotuloProporcao,
  validarArquivoMidia,
} from "./midia";

const MB = 1024 * 1024;

describe("validarArquivoMidia", () => {
  it("aceita imagem, gif e vídeo dentro do limite", () => {
    expect(validarArquivoMidia({ type: "image/png", size: 5 * MB })).toEqual({
      ok: true,
      tipo: "imagem",
    });
    expect(validarArquivoMidia({ type: "image/gif", size: MB })).toEqual({
      ok: true,
      tipo: "animacao",
    });
    expect(validarArquivoMidia({ type: "video/mp4", size: 25 * MB })).toEqual({
      ok: true,
      tipo: "video",
    });
  });
  it("recusa formato fora da lista e arquivo grande", () => {
    expect(validarArquivoMidia({ type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validarArquivoMidia({ type: "image/jpeg", size: 5 * MB + 1 }).ok).toBe(false);
    expect(validarArquivoMidia({ type: "video/webm", size: 25 * MB + 1 }).ok).toBe(false);
  });
});

describe("moverItem", () => {
  it("move para cima e para baixo sem alterar a lista original", () => {
    const l = ["a", "b", "c"];
    expect(moverItem(l, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moverItem(l, 2, 0)).toEqual(["c", "a", "b"]);
    expect(l).toEqual(["a", "b", "c"]);
  });
  it("ignora índices fora da lista", () => {
    expect(moverItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moverItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("palco do login", () => {
  it("desktop é quase quadrado e celular/tablet são faixas largas", () => {
    expect(proporcaoDoPalco("desktop")).toBeCloseTo(0.93, 2);
    expect(proporcaoDoPalco("tablet")).toBeCloseTo(3, 1);
    expect(proporcaoDoPalco("celular")).toBeCloseTo(2.6, 1);
    expect(rotuloProporcao(1.0345)).toBe("1,03 : 1");
  });
  it("limita o foco entre 0 e 100", () => {
    expect([limitarFoco(-5), limitarFoco(49.6), limitarFoco(140)]).toEqual([0, 50, 100]);
  });
});
