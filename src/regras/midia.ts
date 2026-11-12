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
