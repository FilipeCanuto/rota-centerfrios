/** Regras de arquivos de avisos e de mídia do login. O banco repete as mesmas regras (bucket). */
export type TipoMidia = "imagem" | "animacao" | "video";

const MB = 1024 * 1024;
export const LIMITE_IMAGEM_BYTES = 5 * MB;
export const LIMITE_VIDEO_BYTES = 25 * MB;

const POR_MIME: Record<string, TipoMidia> = {
  "image/jpeg": "imagem",
  "image/png": "imagem",
  "image/webp": "imagem",
  "image/avif": "imagem",
  "image/gif": "animacao",
  "video/mp4": "video",
  "video/webm": "video",
};

export const MIMES_ACEITOS = Object.keys(POR_MIME);

export function tipoDoArquivo(mime: string): TipoMidia | null {
  return POR_MIME[mime] ?? null;
}

export type ResultadoArquivo = { ok: true; tipo: TipoMidia } | { ok: false; motivo: string };

export function validarArquivoMidia(arq: { type: string; size: number }): ResultadoArquivo {
  const tipo = tipoDoArquivo(arq.type);
  if (!tipo)
    return { ok: false, motivo: "Formato não aceito. Use JPG, PNG, WebP, AVIF, GIF, MP4 ou WebM." };
  const limite = tipo === "video" ? LIMITE_VIDEO_BYTES : LIMITE_IMAGEM_BYTES;
  if (arq.size > limite)
    return { ok: false, motivo: `Arquivo grande demais. O limite é ${limite / MB} MB.` };
  return { ok: true, tipo };
}

export type Dispositivo = "desktop" | "tablet" | "celular";
export type Enquadramento = "preencher" | "ajustar";

/** Telas de referência de cada aparelho (largura × altura da janela, em px). */
export const TELAS: Record<Dispositivo, { largura: number; altura: number }> = {
  desktop: { largura: 1440, altura: 900 },
  tablet: { largura: 768, altura: 1024 },
  celular: { largura: 375, altura: 812 },
};

/**
 * Tamanho real do palco do login numa tela, espelhando as classes de `routes/auth.tsx`:
 * a partir de 1024 px (lg) o palco ocupa 58% da largura, a altura toda e 16 px de margem de cada
 * lado; abaixo disso é uma faixa de 144 px (< 640), 208 px (≥ 640) ou 256 px (≥ 768) de altura.
 */
export function areaDoPalco(largura: number, altura: number): { largura: number; altura: number } {
  if (largura >= 1024) return { largura: Math.round(largura * 0.58) - 32, altura: altura - 32 };
  return { largura, altura: largura >= 768 ? 256 : largura >= 640 ? 208 : 144 };
}

export const proporcaoDoPalco = (d: Dispositivo) => {
  const a = areaDoPalco(TELAS[d].largura, TELAS[d].altura);
  return a.largura / a.altura;
};

/** "1,03 : 1" (largura : altura). */
export const rotuloProporcao = (p: number) => `${p.toFixed(2).replace(".", ",")} : 1`;

/** Resolução recomendada: o desktop é o palco mais alto (quase quadrado) e os outros recortam uma faixa larga. */
export const RECOMENDACAO_MIDIA = {
  imagem: "1200 × 1200 px (quadrada, JPG/WebP)",
  video: "1080 × 1080 px (quadrado, MP4 H.264, até 10 s, sem som)",
} as const;

/** Ponto de foco (0–100) usado em `object-position`. */
export const limitarFoco = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Intervalo entre itens do palco do login. */
export const INTERVALO_PALCO_MS = 12_000;

/** Move o item de `de` para `para`, devolvendo uma lista nova (índices fora da lista não mudam nada). */
export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  const nova = [...lista];
  if (de === para || de < 0 || para < 0 || de >= nova.length || para >= nova.length) return nova;
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item as T);
  return nova;
}
