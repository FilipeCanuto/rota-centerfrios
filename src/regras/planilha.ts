/** Leitura de planilhas CSV exportadas do Shop9 (ou salvas no Excel como CSV). Funções puras. */

/** Separador mais provável: o Excel em português salva com ";". */
function separador(primeiraLinha: string): string {
  const conta = (s: string) => primeiraLinha.split(s).length;
  return conta(";") >= conta(",") ? ";" : ",";
}

/** Uma linha lida do CSV, com o número dela no arquivo (o mesmo que o Excel mostra). */
export interface LinhaCsv {
  numero: number;
  valores: string[];
}

/**
 * CSV para linhas. Aceita aspas, aspas duplicadas, quebra de linha dentro de aspas e BOM.
 * Aspas só abrem no começo do campo (`Freezer 20"` é texto). Linhas vazias são puladas.
 */
export function lerCsv(texto: string): LinhaCsv[] {
  const t = texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sep = separador(t.split("\n", 1)[0] ?? "");
  const linhas: LinhaCsv[] = [];
  let valores: string[] = [];
  let campo = "";
  let aspas = false;
  let numero = 1;
  let inicio = 1;
  const fechar = () => {
    valores.push(campo);
    if (valores.some((v) => v.trim() !== "")) linhas.push({ numero: inicio, valores });
    valores = [];
    campo = "";
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (c === "\n") numero++;
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) {
      valores.push(campo);
      campo = "";
    } else if (c === "\n") {
      fechar();
      inicio = numero;
    } else campo += c;
  }
  if (campo !== "" || valores.length) fechar();
  return linhas;
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
  // "1.234" e "1.234.567" sem vírgula: ponto é separador de milhar (padrão brasileiro).
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
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

/** Telefone com DDI 55, só dígitos; nulo se não for um número brasileiro com DDD. Vazio continua vazio. */
export function lerTelefone(s: string): string | null {
  const d = s.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}
