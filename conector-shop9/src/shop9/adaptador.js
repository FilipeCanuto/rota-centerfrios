import { criarClienteShop9, ErroShop9 } from "./cliente.js";
import * as m from "./mapear.js";

export { ErroShop9 };

/**
 * Única camada que conhece o Shop9 de ponta a ponta: recursos, janelas incrementais e envio de orçamento.
 * `empresa` vem da Rota (só códigos, nada sensível): { empresa_id, codfilial, codigo_operacao_orcamento,
 * tipo_operacao_orcamento, tipos_venda, tabela_preco, codigo_caixa }.
 */
const p2 = (n) => String(n).padStart(2, "0");
/** Data/hora local no formato do Shop9: YYYY-MM-DD HH:MM:SS. */
export const dataHora = (d) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const lerDataHora = (s) => new Date(s.replace(" ", "T"));
const dia = (s) => s.slice(0, 10);
const diaBr = (s) => s.slice(0, 10).split("-").reverse().join("-"); // /v3/precos usa DD-MM-YYYY

export const SOBREPOSICAO_MS = 2 * 60_000;

/**
 * Janelas [de, ate] do cursor até agora. Recomeça 2 min antes do cursor: o que mudou durante a leitura
 * anterior não se perde. `porDia` (saídas e devoluções) corta na meia-noite, porque a data de efetivação
 * de uma venda é o dia da janela.
 */
export function janelas(cursor, agora, inicio, porDia = true) {
  const fim = new Date(agora);
  let de = new Date(
    cursor ? lerDataHora(cursor).getTime() - SOBREPOSICAO_MS : lerDataHora(inicio).getTime(),
  );
  const lista = [];
  while (de < fim) {
    const meiaNoite = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 1);
    const ate = porDia && meiaNoite < fim ? new Date(meiaNoite.getTime() - 1000) : fim;
    lista.push([dataHora(de), dataHora(ate)]);
    de = porDia ? meiaNoite : fim;
  }
  return lista;
}

/** Recurso da Rota → como ler no Shop9. `passadas` = saídas/devoluções lidas por efetivação e por alteração. */
export const RECURSOS = {
  funcionarios: {
    caminho: "funcionarios",
    filtros: () => ({ vendedor: "true" }),
    mapa: m.funcionario,
  },
  clientes: { caminho: "clientes", mapa: m.cliente },
  produtos: { caminho: "produtos", mapa: (r, e) => m.produto(r, e.tabela_preco) },
  precos: {
    caminho: "v3/precos",
    datas: ([de, ate]) => ({ datade: diaBr(de), dataate: diaBr(ate) }),
    mapa: (r, e) => m.precos(r, e.tabela_preco),
    precisa: (e) => !!e.tabela_preco,
  },
  estoque: { caminho: "v2/estoque", mapa: (r, e) => m.estoque(r, e.codfilial) },
  credito: {
    caminho: "credito/cliente/saldos",
    datas: ([de, ate]) => ({ datade: de, dataAte: ate }),
    mapa: m.credito,
  },
  motivos_desconto: {
    caminho: "motivos_desconto",
    paginado: false,
    datas: ([de, ate]) => ({ datade: dia(de), dataate: dia(ate) }),
    mapa: m.motivoDesconto,
  },
  vendas: {
    caminho: "saidas",
    filtros: (e) => ({ tiposoperacao: e.tipos_venda || "VND" }),
    passadas: ["E", "A"],
    mapa: (r, _e, data) => m.venda(r, data),
  },
  devolucoes: {
    caminho: "devolucao",
    passadas: ["E", "A"],
    mapa: (r, _e, data) => m.devolucao(r, data),
  },
};
/** Ordem de leitura: vendedores e clientes antes das vendas que os citam. */
export const ORDEM_RECURSOS = Object.keys(RECURSOS);

export function criarAdaptadorShop9(s, opcoes) {
  const api = criarClienteShop9(s, opcoes);

  /** Páginas de linhas da Rota de um recurso numa janela. */
  async function* ler(tipo, empresa, janela) {
    const r = RECURSOS[tipo];
    if (r.precisa && !r.precisa(empresa)) return;
    const datas = r.datas ? r.datas(janela) : { datade: janela[0], dataate: janela[1] };
    for (const passada of r.passadas ?? [null]) {
      const filtros = { ...(passada ? { tipodata: passada } : {}), ...datas, ...r.filtros?.(empresa) };
      const efetivacao = passada === "E" ? dia(janela[1]) : null;
      const mapear = (x) => [r.mapa(x, empresa, efetivacao)].flat();
      if (r.paginado === false) {
        const q = new URLSearchParams(filtros);
        const env = await api.pedir("get", `/${r.caminho}?${q}`, empresa.codfilial);
        const lista = Array.isArray(env.dados) ? env.dados : [];
        if (lista.length) yield { chave: `${passada ?? "-"}:1`, linhas: lista.flatMap(mapear) };
        continue;
      }
      for await (const pg of api.paginar(r.caminho, empresa.codfilial, filtros))
        yield { chave: `${passada ?? "-"}:${pg.pagina}`, linhas: pg.registros.flatMap(mapear) };
    }
  }

  /** Procura a saída deste envio pela marca ROTA:<id> (observação ou referência interna). */
  async function procurar(empresa, marca, desde) {
    const filtros = {
      tipodata: "C",
      datade: desde,
      dataate: dataHora(new Date()),
      tiposoperacao: empresa.tipo_operacao_orcamento || "ORC",
    };
    for await (const pg of api.paginar("saidas", empresa.codfilial, filtros)) {
      const achou = pg.registros.find(
        (r) =>
          String(r.observacao ?? "").includes(marca) || String(r.referenciaInterna ?? "") === marca,
      );
      if (achou) return String(achou.ordem);
    }
    return null;
  }

  /**
   * Orçamento da fila da Rota → saída no Shop9, sem efetivar estoque nem financeiro (não chama os PATCH).
   * Nunca duplica: procura pela marca antes de criar (reenvio após falha ou tempo esgotado) e, como o POST
   * não devolve a ordem, procura de novo depois de criar.
   */
  async function enviarOrcamento(empresa, t) {
    if (!empresa.codigo_operacao_orcamento)
      throw new ErroShop9("CONFIGURACAO", "Código de operação do orçamento não configurado na Rota");
    const marca = `ROTA:${t.envio_id}`;
    const ontem = new Date(Date.parse(`${t.data}T00:00:00`) - 86_400_000);
    const desde = `${dia(dataHora(ontem))} 00:00:00`;
    const existente = await procurar(empresa, marca, desde);
    if (existente) return existente;
    await api.pedir("post", "/saidas", empresa.codfilial, {
      codigoCliente: String(t.cliente_codigo),
      codigoOperacao: String(empresa.codigo_operacao_orcamento),
      usarValoresTabelaPrecos: false,
      desconto_Total_Geral: 0,
      observacao: `${marca} - orçamento da Rota`,
      ReferenciaInterna: marca,
      codigoVendedor_1: Number(t.vendedor_codigo_shop9 || 0),
      codigoVendedor_2: 0,
      codigoCaixa: Number(empresa.codigo_caixa || 0),
      tabelaPreco: empresa.tabela_preco || null,
      data: dataHora(new Date()),
      produtos: t.itens.map((i) => ({
        codigo: String(i.codigo_produto),
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.preco_unit),
        descontoUnitario:
          m.centavos((Number(i.preco_unit) * Number(i.desconto_pct || 0)) / 100) / 100,
      })),
    });
    const ordem = await procurar(empresa, marca, desde);
    if (!ordem)
      throw new ErroShop9(
        "ORDEM_NAO_ENCONTRADA",
        "Shop9 aceitou o orçamento, mas a ordem ainda não apareceu; será conferida no próximo envio",
      );
    return ordem;
  }

  return { ping: (codfilial) => api.token(codfilial), ler, enviarOrcamento, procurar };
}
