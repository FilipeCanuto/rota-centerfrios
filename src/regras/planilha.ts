/** Leitura de planilhas CSV exportadas do Shop9 (ou salvas no Excel como CSV). Funções puras. */

/** Separador mais provável: o Excel em português salva com ";". */
function separador(primeiraLinha: string): string {
  const conta = (s: string) => primeiraLinha.split(s).length;
  return conta(";") >= conta(",") ? ";" : ",";
}

/** CSV para matriz de textos. Aceita aspas, aspas duplicadas, quebra de linha dentro de aspas e BOM. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const sep = separador(t.split(/\r?\n/, 1)[0] ?? "");
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

/** Texto sem acento, minúsculo e só com letras e números, para comparar cabeçalhos. */
export function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Número no formato brasileiro ("1.234,56") ou internacional ("1234.56"). */
export function lerNumero(s: string): number | null {
  const t = s.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Data "dd/mm/aaaa" (ou "aaaa-mm-dd") para "aaaa-mm-dd"; nula se inválida. */
export function lerData(s: string): string | null {
  const t = s.trim();
  let a: number, m: number, d: number;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (br)
    [d, m, a] = [Number(br[1]), Number(br[2]), Number(br[3]!.length === 2 ? `20${br[3]}` : br[3])];
  else if (iso) [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
