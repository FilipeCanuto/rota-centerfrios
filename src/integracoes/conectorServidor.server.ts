import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verificarAssinatura } from "@/regras/conector";

/**
 * Entrada do conector Shop9 (POST /api/conector/<acao>). Ordem: cabeçalhos → chave do conector ativo →
 * HMAC + horário → nonce no banco (repetição e limite de taxa) → ação. Respostas de erro sem detalhe.
 * Funções do banco só para service_role: ver docs/lovable/21-conector-shop9.md.
 */
const LIMITE_CORPO = 5 * 1024 * 1024;

const rpc = supabaseAdmin.rpc as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

const id = z.string().uuid();
const ACOES = {
  heartbeat: z.object({ versao: z.string().max(40), shop9_ok: z.boolean() }),
  trabalhos: z.object({ limite: z.number().int().min(1).max(50).default(10) }),
  resultado: z.object({
    envio_id: id,
    ok: z.boolean(),
    codigo_shop9: z.string().trim().min(1).max(60).nullable(),
    erro: z.string().max(500).nullable(),
  }),
  sincronizar: z.object({
    tipo: z.enum(["clientes", "produtos", "vendas", "orcamentos"]),
    empresa_id: id,
    lote_id: z.string().regex(/^[\w:.-]{8,120}$/),
    linhas: z.array(z.record(z.unknown())).max(5000),
  }),
} as const;
type Acao = keyof typeof ACOES;

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function atenderConector(request: Request, acao: string): Promise<Response> {
  if (!(acao in ACOES)) return resposta(404, { erro: "acao" });
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > LIMITE_CORPO) return resposta(413, { erro: "tamanho" });
  const corpo = await request.text();
  if (corpo.length > LIMITE_CORPO) return resposta(413, { erro: "tamanho" });

  const conectorId = request.headers.get("x-conector-id") ?? "";
  if (!id.safeParse(conectorId).success) return resposta(401, { erro: "autenticacao" });

  const chave = await rpc("conector_chave", { _conector_id: conectorId });
  if (chave.error) return resposta(500, { erro: "interno" });
  // Nulo = inexistente ou revogado: mesma resposta, para não revelar qual.
  if (typeof chave.data !== "string") return resposta(401, { erro: "autenticacao" });

  const nonce = request.headers.get("x-conector-nonce");
  const falha = await verificarAssinatura(chave.data, {
    ts: request.headers.get("x-conector-ts"),
    nonce,
    assinatura: request.headers.get("x-conector-assinatura"),
    metodo: request.method,
    caminho: new URL(request.url).pathname,
    corpo,
  });
  if (falha) return resposta(401, { erro: "autenticacao" });

  const reg = await rpc("conector_registrar_pedido", {
    _conector_id: conectorId,
    _nonce: nonce,
    _acao: acao,
  });
  if (reg.error?.code === "P0409") return resposta(409, { erro: "repetida" });
  if (reg.error?.code === "P0429") return resposta(429, { erro: "limite" });
  if (reg.error) return resposta(401, { erro: "autenticacao" });

  let json: unknown;
  try {
    json = JSON.parse(corpo || "{}");
  } catch {
    return resposta(400, { erro: "json" });
  }
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
