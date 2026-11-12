import { describe, expect, it } from "vitest";
import { validarArquivoMidia } from "./midia";

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
