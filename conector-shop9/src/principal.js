import { sha256Hex } from "./assinatura.js";
import {
  criarAdaptadorShop9,
  ErroShop9,
  janelas,
  ORDEM_RECURSOS,
  RECURSOS,
} from "./shop9/adaptador.js";

export const VERSAO = "0.2.0";

async function enviarOrcamentos({ chamar, shop9, log }, empresas) {
  const { trabalhos = [] } = (await chamar("trabalhos", { limite: 10 })) ?? {};
  for (const t of trabalhos) {
    let resultado;
    try {
      const empresa = empresas.get(t.empresa_id);
      if (!empresa?.codfilial) throw new ErroShop9("CONFIGURACAO", "Filial desta empresa não configurada na Rota");
      resultado = { ok: true, codigo_shop9: await shop9.enviarOrcamento(empresa, t), erro: null };
    } catch (e) {
      resultado = {
        ok: false,
        codigo_shop9: null,
        erro: e instanceof ErroShop9 ? `${e.tipo}: ${e.message}` : "Falha inesperada no conector",
      };
    }
    await chamar("resultado", { envio_id: t.envio_id, ...resultado });
    log(resultado.ok ? "info" : "aviso", "orcamento_enviado", { envio_id: t.envio_id, ok: resultado.ok, erro: resultado.erro });
  }
  return trabalhos.length;
}

const LINHAS_POR_LOTE = 500;

/**
 * Lê cada recurso de cada empresa em janelas desde o cursor guardado na Rota. As linhas vão em lotes de até
 * 500; cada lote leva o cursor da última janela já lida por inteiro, gravado no banco junto com as linhas
 * (se cair no meio, recomeça dali e as gravações repetidas são idempotentes).
 */
async function sincronizar({ cfg, chamar, log }, shop9, empresas, cursores, agora) {
  let total = 0;
  for (const empresa of empresas.values())
    for (const tipo of ORDEM_RECURSOS) {
      const inicial = cursores[`${tipo}:${empresa.empresa_id}`] ?? null;
      const lista = janelas(inicial, agora, cfg.inicio_sincronizacao, !!RECURSOS[tipo].passadas);
      let buffer = [];
      let pronto = null; // fim da última janela lida por inteiro
      const enviar = async () => {
        const dados = { tipo, empresa_id: empresa.empresa_id, linhas: buffer, cursor: pronto };
        // id = hash do conteúdo: o reenvio idêntico é reconhecido; conteúdo novo nunca é tomado por repetição
        const id = `${tipo}:${sha256Hex(JSON.stringify(dados)).slice(0, 32)}`;
        await chamar("sincronizar", { ...dados, lote_id: id });
        if (buffer.length) log("info", "lote_sincronizado", { tipo, empresa_id: empresa.empresa_id, linhas: buffer.length });
        total += buffer.length;
        buffer = [];
      };
      for (const janela of lista) {
        for await (const pg of shop9.ler(tipo, empresa, janela)) {
          buffer.push(...pg.linhas);
          if (buffer.length >= LINHAS_POR_LOTE) await enviar();
        }
        pronto = janela[1];
      }
      if (pronto) await enviar();
    }
  return total;
}

/**
 * Um ciclo: heartbeat (a Rota devolve modo, ambiente, empresas e cursores) → teste do Shop9 em cada filial →
 * (modo conector) orçamentos da fila → sincronização incremental, no intervalo próprio dela.
 */
export async function ciclo(ctx, agora = Date.now()) {
  const { cfg, chamar, log } = ctx;
  const r = await chamar("heartbeat", { versao: VERSAO, shop9_ok: ctx.shop9Ok ?? false });
  const credenciais = cfg.shop9[r.ambiente];
  if (!credenciais) throw new Error(`Ambiente ${r.ambiente} sem credenciais neste computador`);
  const empresas = new Map((r.empresas ?? []).filter((e) => e.codfilial).map((e) => [e.empresa_id, e]));
  if (ctx.ambiente !== r.ambiente || !ctx.shop9) ctx.shop9 = ctx.criarShop9?.(credenciais) ?? criarAdaptadorShop9(credenciais);
  ctx.ambiente = r.ambiente;
  try {
    for (const e of empresas.values()) await ctx.shop9.ping(e.codfilial);
    ctx.shop9Ok = true;
  } catch (e) {
    ctx.shop9Ok = false;
    log("aviso", "shop9_indisponivel", { tipo: e.tipo, mensagem: e.message });
    return { enviados: 0, sincronizados: 0 };
  }
  const enviados =
    r.modo === "conector" ? await enviarOrcamentos({ ...ctx, shop9: ctx.shop9 }, empresas) : 0;
  let sincronizados = 0;
  if (!ctx.ultimaSync || agora - ctx.ultimaSync >= cfg.intervalo_sincronizacao_s * 1000) {
    sincronizados = await sincronizar(ctx, ctx.shop9, empresas, r.cursores ?? {}, agora);
    ctx.ultimaSync = agora;
  }
  return { enviados, sincronizados };
}
