import { createHmac } from "node:crypto";

/**
 * Única camada que conhece o Shop9. Trocar o simulador pela API real = ajustar este arquivo.
 *
 * A COMPLETAR com a documentação da Idealsoft (docs/shop9-mapeamento.md):
 * - autenticação: hoje série + timestamp + HMAC(senha, timestamp + caminho), formato suposto;
 * - caminhos e nomes de campo reais (MAPA abaixo) e paginação;
 * - campo de chave externa para não duplicar orçamento.
 */
export function cabecalhosShop9(s, caminho, agora = Date.now()) {
  const ts = String(Math.floor(agora / 1000));
  return {
    "x-shop9-serie": s.serie,
    "x-shop9-timestamp": ts,
    "x-shop9-signature": createHmac("sha256", s.senha).update(`${ts}${caminho}`).digest("hex"),
  };
}

/** Campo da Rota ← campo do Shop9 (formato das linhas de src/regras/importacao.ts). */
export const MAPA = {
  produtos: {
    codigo_shop9: "Codigo",
    descricao: "Descricao",
    unidade: "Unidade",
    preco_tabela: "Preco",
    ativo: "Ativo",
  },
  clientes: {
    codigo_shop9: "Codigo",
    nome: "RazaoSocial",
    telefone: "Fone",
    documento: "CpfCnpj",
    email: "Email",
    segmento: "Segmento",
    cidade: "Cidade",
    vendedor_email: "EmailVendedor",
  },
  vendas: {
    codigo_shop9: "NumeroNota",
    cliente_codigo: "CodigoCliente",
    data_faturamento: "DataFaturamento",
    valor: "ValorTotal",
    produto: "DescricaoProduto",
    codigo_produto: "CodigoProduto",
    quantidade: "Quantidade",
    valor_item: "ValorItem",
  },
  orcamentos: {
    codigo_shop9: "Numero",
    cliente_codigo: "CodigoCliente",
    data: "Data",
    valor: "ValorTotal",
    status: "Situacao",
  },
};

export const paraLinhaRota = (tipo, r) =>
  Object.fromEntries(Object.entries(MAPA[tipo]).map(([rota, shop9]) => [rota, r[shop9] ?? null]));

export class ErroShop9 extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
    /** 4xx = recusa de regra (não adianta repetir igual); 5xx/rede = temporário. */
    this.definitivo = status >= 400 && status < 500;
  }
}

export function criarAdaptadorShop9(s) {
  const base = s.url.replace(/\/$/, "");
  async function pedir(metodo, caminho, corpo) {
    let r;
    try {
      r = await fetch(base + caminho, {
        method: metodo,
        headers: {
          "content-type": "application/json",
          ...cabecalhosShop9(s, caminho.split("?")[0]),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new ErroShop9(0, `Shop9 indisponível: ${e.message}`);
    }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErroShop9(r.status, dados.mensagem || `Shop9 respondeu ${r.status}`);
    return dados;
  }

  return {
    ping: () => pedir("GET", "/status"),
    /** Cria o orçamento; a chave externa faz o Shop9 devolver o mesmo número se repetirmos. */
    async criarOrcamento(filial, envio) {
      const r = await pedir("POST", "/orcamentos", {
        Filial: filial,
        ChaveExterna: envio.chave_idempotencia,
        CodigoCliente: envio.cliente_codigo,
        EmailVendedor: envio.vendedor_email,
        Data: envio.data,
        Itens: envio.itens.map((i) => ({
          CodigoProduto: i.codigo_produto,
          Quantidade: i.quantidade,
          PrecoUnitario: i.preco_unit,
          DescontoPct: i.desconto_pct,
        })),
      });
      return String(r.Numero);
    },
    /** Registros alterados desde o cursor, em páginas. Devolve linhas no formato da Rota e o novo cursor. */
    async listar(tipo, filial, desde, limite) {
      const q = new URLSearchParams({ filial, desde: desde ?? "", limite: String(limite) });
      const r = await pedir("GET", `/${tipo}?${q}`);
      return {
        linhas: r.Itens.map((x) => paraLinhaRota(tipo, x)),
        cursor: r.Cursor ?? desde,
        mais: !!r.Mais,
      };
    },
  };
}
