import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { criarAdaptadorShop9, ErroShop9 } from "./shop9/adaptador.js";

export const VERSAO = "0.1.0";
const TIPOS = ["clientes", "produtos", "vendas", "orcamentos"];

/** Cursores da sincronização incremental, gravados de forma atômica (arquivo temporário + rename). */
export function criarEstado(arquivo) {
  let estado = {};
  try {
    if (arquivo) estado = JSON.parse(readFileSync(arquivo, "utf8"));
  } catch {
    estado = {};
  }
  return {
    cursor: (chave) => estado[chave] ?? null,
    salvar(chave, valor) {
      estado[chave] = valor;
      if (!arquivo) return;
      writeFileSync(`${arquivo}.tmp`, JSON.stringify(estado));
      renameSync(`${arquivo}.tmp`, arquivo);
    },
  };
}

async function enviarOrcamentos({ cfg, chamar, shop9, log }) {
  const { trabalhos = [] } = (await chamar("trabalhos", { limite: 10 })) ?? {};
  for (const t of trabalhos) {
    const filial = cfg.filiais[t.empresa_id];
    let resultado;
    try {
      if (!filial) throw new ErroShop9(400, "Filial desta empresa não configurada no conector");
      resultado = { ok: true, codigo_shop9: await shop9.criarOrcamento(filial, t), erro: null };
    } catch (e) {
      resultado = {
        ok: false,
        codigo_shop9: null,
        erro: e instanceof ErroShop9 ? e.message : "Falha inesperada no conector",
      };
    }
    await chamar("resultado", { envio_id: t.envio_id, ...resultado });
    log(resultado.ok ? "info" : "aviso", "orcamento_enviado", {
      envio_id: t.envio_id,
      ok: resultado.ok,
      erro: resultado.erro,
    });
  }
  return trabalhos.length;
}

async function sincronizar({ cfg, chamar, shop9, estado, log }) {
  let total = 0;
  for (const [empresaId, filial] of Object.entries(cfg.filiais))
    for (const tipo of TIPOS) {
      const chave = `${tipo}:${empresaId}`;
      for (let mais = true; mais;) {
        const desde = estado.cursor(chave);
        const pagina = await shop9.listar(tipo, filial, desde, cfg.lote);
        mais = pagina.mais;
        if (pagina.linhas.length) {
          // lote_id determinístico: se cair antes de salvar o cursor, o reenvio cai no mesmo lote (idempotente).
          const loteId = `${tipo}:${empresaId}:${desde ?? 0}:${pagina.cursor}`;
          await chamar("sincronizar", {
            tipo,
            empresa_id: empresaId,
            lote_id: loteId,
            linhas: pagina.linhas,
          });
          total += pagina.linhas.length;
          log("info", "lote_sincronizado", {
            tipo,
            empresa_id: empresaId,
            linhas: pagina.linhas.length,
          });
        }
        estado.salvar(chave, pagina.cursor);
      }
    }
  return total;
}

/** Um ciclo: heartbeat → (modo conector) orçamentos da fila → sincronização incremental. */
export async function ciclo(ctx) {
  const { cfg, chamar, log } = ctx;
  let shop9Ok = false;
  const ambiente0 = cfg.shop9.producao ? "producao" : "homologacao";
  try {
    await criarAdaptadorShop9(cfg.shop9[ctx.ambiente ?? ambiente0]).ping();
    shop9Ok = true;
  } catch (e) {
    log("aviso", "shop9_indisponivel", { mensagem: e.message });
  }
  const { modo, ambiente } = await chamar("heartbeat", { versao: VERSAO, shop9_ok: shop9Ok });
  ctx.ambiente = ambiente;
  if (!cfg.shop9[ambiente])
    throw new Error(`Ambiente ${ambiente} sem credenciais neste computador`);
  if (!shop9Ok) return { enviados: 0, sincronizados: 0 };
  const shop9 = criarAdaptadorShop9(cfg.shop9[ambiente]);
  const enviados = modo === "conector" ? await enviarOrcamentos({ ...ctx, shop9 }) : 0;
  const sincronizados = await sincronizar({ ...ctx, shop9 });
  return { enviados, sincronizados };
}
