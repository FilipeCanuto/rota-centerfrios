import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  codigoPareamentoValido,
  criarLimitador,
  normalizarCodigoPareamento,
  prechecar,
  verificarAssinatura,
} from "@/regras/conector";

/**
 * Entrada do conector Shop9 (POST /api/conector/<acao>). Ordem, do mais barato ao mais caro:
 * ação e tamanho → cabeçalhos e janela de horário → limite de taxa em memória → chaves públicas do conector
 * ativo (a atual e, durante a troca, a anterior) → assinatura Ed25519 → nonce no banco (repetição e limite real)
 * → ação. `parear` é a exceção: sem conector ainda, assina com a chave nova e prova o código de uso único.
 * Respostas de erro sem detalhe. Funções do banco só para service_role: docs/lovable/21 e 22.
 */
const LIMITE_CORPO = 5 * 1024 * 1024;
const porConector = criarLimitador(300, 60_000);
const porIpPareamento = criarLimitador(5, 60_000);
const chave43 = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const rpc = supabaseAdmin.rpc as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

const id = z.string().uuid();
const TIPOS_SINCRONIZACAO = [
  "funcionarios",
  "clientes",
  "produtos",
  "precos",
  "estoque",
  "vendas",
  "devolucoes",
  "credito",
  "motivos_desconto",
  "orcamentos",
] as const;
const PAREAR = z.object({
  codigo: z.string().refine(codigoPareamentoValido).transform(normalizarCodigoPareamento),
  chave_publica: chave43,
  nome: z.string().trim().min(1).max(60),
});
const ACOES = {
  trocar_chave: z.object({ chave_publica: chave43 }),
  heartbeat: z.object({ versao: z.string().max(40), shop9_ok: z.boolean() }),
  trabalhos: z.object({ limite: z.number().int().min(1).max(50).default(10) }),
  resultado: z.object({
    envio_id: id,
    ok: z.boolean(),
    codigo_shop9: z.string().trim().min(1).max(60).nullable(),
    erro: z.string().max(500).nullable(),
  }),
  sincronizar: z.object({
    tipo: z.enum(TIPOS_SINCRONIZACAO),
    empresa_id: id,
    lote_id: z.string().regex(/^[\w:.-]{8,160}$/),
    linhas: z.array(z.record(z.unknown())).max(5000),
    cursor: z.string().max(40).nullable().default(null),
  }),
} as const;
type Acao = keyof typeof ACOES;

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const ip = (r: Request) =>
  r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || r.headers.get("x-real-ip") || "?";

const lerJson = (corpo: string): unknown => {
  try {
    return JSON.parse(corpo || "{}");
  } catch {
    return undefined;
  }
};

export async function atenderConector(request: Request, acao: string): Promise<Response> {
  if (!(acao in ACOES) && acao !== "parear") return resposta(404, { erro: "acao" });
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > LIMITE_CORPO) return resposta(413, { erro: "tamanho" });
  const corpo = await request.text();
  if (corpo.length > LIMITE_CORPO) return resposta(413, { erro: "tamanho" });

  const pedido = {
    ts: request.headers.get("x-conector-ts"),
    nonce: request.headers.get("x-conector-nonce"),
    assinatura: request.headers.get("x-conector-assinatura"),
    metodo: request.method,
    caminho: new URL(request.url).pathname,
    corpo,
  };
  if (prechecar(pedido)) return resposta(401, { erro: "autenticacao" });
  if (acao === "parear") return parear(request, pedido);

  const conectorId = request.headers.get("x-conector-id") ?? "";
  if (!id.safeParse(conectorId).success) return resposta(401, { erro: "autenticacao" });
  if (!porConector(conectorId)) return resposta(429, { erro: "limite" });

  const chaves = await rpc("conector_chaves", { _conector_id: conectorId });
  if (chaves.error) return resposta(500, { erro: "interno" });
  // Vazio = inexistente ou revogado: mesma resposta, para não revelar qual.
  const lista = Array.isArray(chaves.data) ? (chaves.data as string[]) : [];
  if (!lista.length || (await verificarAssinatura(lista, pedido)))
    return resposta(401, { erro: "autenticacao" });

  const reg = await rpc("conector_registrar_pedido", {
    _conector_id: conectorId,
    _nonce: pedido.nonce,
    _acao: acao,
  });
  if (reg.error?.code === "P0409") return resposta(409, { erro: "repetida" });
  if (reg.error?.code === "P0429") return resposta(429, { erro: "limite" });
  if (reg.error) return resposta(401, { erro: "autenticacao" });

  const json = lerJson(corpo);
  if (json === undefined) return resposta(400, { erro: "json" });
  const dados = ACOES[acao as Acao].safeParse(json);
  if (!dados.success)
    return resposta(400, {
      erro: "dados",
      campos: dados.error.issues.map((i) => i.path.join(".")),
    });

  const args = Object.fromEntries(Object.entries(dados.data).map(([k, v]) => [`_${k}`, v]));
  const r = await rpc(`conector_${acao}`, { _conector_id: conectorId, ...args });
  if (r.error)
    return resposta(r.error.code === "P0001" ? 422 : 500, {
      erro: r.error.code === "P0001" ? r.error.message : "interno",
    });
  return resposta(200, r.data ?? {});
}

/** Primeiro contato: a assinatura com a chave do corpo prova a posse da chave privada; o banco gasta o código. */
async function parear(request: Request, pedido: Parameters<typeof verificarAssinatura>[1]) {
  if (!porIpPareamento(ip(request))) return resposta(429, { erro: "limite" });
  const dados = PAREAR.safeParse(lerJson(pedido.corpo));
  if (!dados.success) return resposta(400, { erro: "dados" });
  if (await verificarAssinatura(dados.data.chave_publica, pedido))
    return resposta(401, { erro: "autenticacao" });
  const r = await rpc("conector_parear", {
    _codigo: dados.data.codigo,
    _chave_publica: dados.data.chave_publica,
    _nome: dados.data.nome,
  });
  // Código errado, vencido ou já usado: resposta única.
  if (r.error) return resposta(r.error.code === "P0001" ? 401 : 500, { erro: "codigo" });
  return resposta(200, r.data ?? {});
}
