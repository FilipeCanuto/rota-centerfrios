import { lerData, lerNumero, lerTelefone, normalizarCabecalho, type LinhaCsv } from "./planilha";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TipoImportacao = "clientes" | "vendas" | "orcamentos";

export interface CampoImportacao {
  chave: string;
  rotulo: string;
  obrigatorio: boolean;
  /** Nomes de coluna que o Shop9 costuma usar (comparados sem acento e sem espaço). */
  apelidos: string[];
}

export const CAMPOS: Record<TipoImportacao, CampoImportacao[]> = {
  clientes: [
    {
      chave: "codigo_shop9",
      rotulo: "Código do cliente",
      obrigatorio: true,
      apelidos: ["codigo", "codcliente", "codigocliente", "cod"],
    },
    {
      chave: "nome",
      rotulo: "Nome",
      obrigatorio: true,
      apelidos: ["nome", "razaosocial", "cliente", "nomefantasia"],
    },
    {
      chave: "telefone",
      rotulo: "Telefone",
      obrigatorio: false,
      apelidos: ["telefone", "celular", "fone", "whatsapp"],
    },
    {
      chave: "documento",
      rotulo: "CPF ou CNPJ",
      obrigatorio: false,
      apelidos: ["cnpj", "cpf", "cpfcnpj", "documento"],
    },
    { chave: "email", rotulo: "E-mail", obrigatorio: false, apelidos: ["email"] },
    {
      chave: "segmento",
      rotulo: "Segmento",
      obrigatorio: false,
      apelidos: ["segmento", "ramo", "atividade"],
    },
    { chave: "cidade", rotulo: "Cidade", obrigatorio: false, apelidos: ["cidade", "municipio"] },
    {
      chave: "vendedor_email",
      rotulo: "E-mail do vendedor",
      obrigatorio: true,
      apelidos: ["vendedoremail", "emailvendedor", "vendedor"],
    },
  ],
  vendas: [
    {
      chave: "codigo_shop9",
      rotulo: "Número da nota",
      obrigatorio: true,
      apelidos: ["nota", "numeronota", "nf", "numero", "documento", "pedido"],
    },
    {
      chave: "cliente_codigo",
      rotulo: "Código do cliente",
      obrigatorio: true,
      apelidos: ["codcliente", "codigocliente", "cliente"],
    },
    {
      chave: "data_faturamento",
      rotulo: "Data de faturamento",
      obrigatorio: true,
      apelidos: ["datafaturamento", "faturamento", "data", "emissao"],
    },
    {
      chave: "valor",
      rotulo: "Valor da nota",
      obrigatorio: false,
      apelidos: ["valornota", "valortotal", "total", "valor"],
    },
    {
      chave: "produto",
      rotulo: "Produto (um por linha)",
      obrigatorio: false,
      apelidos: ["produto", "descricao", "item"],
    },
    {
      chave: "codigo_produto",
      rotulo: "Código do produto",
      obrigatorio: false,
      apelidos: ["codproduto", "codigoproduto", "referencia"],
    },
    {
      chave: "quantidade",
      rotulo: "Quantidade",
      obrigatorio: false,
      apelidos: ["quantidade", "qtd", "qtde"],
    },
    {
      chave: "valor_item",
      rotulo: "Valor do item",
      obrigatorio: false,
      apelidos: ["valoritem", "totalitem", "subtotal"],
    },
  ],
  orcamentos: [
    {
      chave: "codigo_shop9",
      rotulo: "Número do orçamento",
      obrigatorio: true,
      apelidos: ["orcamento", "numero", "numeroorcamento", "codigo"],
    },
    {
      chave: "cliente_codigo",
      rotulo: "Código do cliente",
      obrigatorio: true,
      apelidos: ["codcliente", "codigocliente", "cliente"],
    },
    {
      chave: "data",
      rotulo: "Data",
      obrigatorio: true,
      apelidos: ["data", "emissao", "dataorcamento"],
    },
    {
      chave: "valor",
      rotulo: "Valor",
      obrigatorio: true,
      apelidos: ["valor", "total", "valortotal"],
    },
    {
      chave: "status",
      rotulo: "Situação (aberto, ganho, perdido)",
      obrigatorio: true,
      apelidos: ["status", "situacao"],
    },
  ],
};

/** Mapeamento campo → índice da coluna (ou -1). Sugere pelo nome do cabeçalho; cada coluna só uma vez. */
export function sugerirMapeamento(
  tipo: TipoImportacao,
  cabecalho: string[],
): Record<string, number> {
  const colunas = cabecalho.map(normalizarCabecalho);
  const usadas = new Set<number>();
  const mapa: Record<string, number> = {};
  for (const campo of CAMPOS[tipo]) {
    const i = campo.apelidos
      .map((a) => colunas.findIndex((c, j) => !usadas.has(j) && c === a))
      .find((j) => j >= 0);
    mapa[campo.chave] = i ?? -1;
    if (i !== undefined) usadas.add(i);
  }
  return mapa;
}

export interface ErroLinha {
  linha: number;
  campo: string;
  mensagem: string;
}
export type LinhaImportacao = Record<string, unknown> & { linha: number };

const STATUS: Record<string, string> = {
  aberto: "aberto",
  ganho: "ganho",
  perdido: "perdido",
  fechado: "ganho",
  cancelado: "perdido",
};

/**
 * Converte as linhas da planilha (sem o cabeçalho) no formato das funções importar_* do banco.
 * Linhas com erro não seguem; duplicados no mesmo arquivo viram erro (a primeira ocorrência vale).
 * Vendas com uma linha por item são agrupadas pela nota. `primeiraLinha` é o número da 1ª linha de dados.
 */
export function montarLinhas(
  tipo: TipoImportacao,
  dados: LinhaCsv[],
  mapa: Record<string, number>,
): { linhas: LinhaImportacao[]; erros: ErroLinha[] } {
  const erros: ErroLinha[] = [];
  const valor = (l: string[], chave: string) =>
    mapa[chave]! >= 0 ? (l[mapa[chave]!] ?? "").trim() : "";
  const vistos = new Map<string, LinhaImportacao>();
  const linhas: LinhaImportacao[] = [];

  const notasComErro = new Set<string>();
  dados.forEach(({ numero: n, valores: l }) => {
    const erro = (campo: string, mensagem: string): void => {
      erros.push({ linha: n, campo, mensagem });
    };
    const faltando = CAMPOS[tipo].find((c) => c.obrigatorio && !valor(l, c.chave));
    if (faltando) {
      if (tipo === "vendas" && valor(l, "codigo_shop9")) notasComErro.add(valor(l, "codigo_shop9"));
      return erro(faltando.chave, `${faltando.rotulo} vazio.`);
    }
    const codigo = valor(l, "codigo_shop9");

    if (tipo === "clientes") {
      if (vistos.has(codigo))
        return erro(
          "codigo_shop9",
          `Código ${codigo} repetido no arquivo (vale a primeira linha).`,
        );
      const email = valor(l, "email");
      if (email && !EMAIL.test(email)) return erro("email", "E-mail inválido.");
      if (!EMAIL.test(valor(l, "vendedor_email")))
        return erro(
          "vendedor_email",
          "E-mail do vendedor inválido (a coluna precisa ter o e-mail, não o nome).",
        );
      const fone = lerTelefone(valor(l, "telefone"));
      if (fone === null) return erro("telefone", "Telefone inválido: use DDD e número.");
      const nova: LinhaImportacao = {
        linha: n,
        codigo_shop9: codigo,
        nome: valor(l, "nome"),
        telefone: fone,
        documento: valor(l, "documento").replace(/\D/g, ""),
        email,
        segmento: valor(l, "segmento"),
        cidade: valor(l, "cidade"),
        vendedor_email: valor(l, "vendedor_email").toLowerCase(),
      };
      vistos.set(codigo, nova);
      linhas.push(nova);
      return;
    }

    if (tipo === "orcamentos") {
      if (vistos.has(codigo))
        return erro(
          "codigo_shop9",
          `Orçamento ${codigo} repetido no arquivo (vale a primeira linha).`,
        );
      const data = lerData(valor(l, "data"));
      if (!data) return erro("data", "Data inválida (use dd/mm/aaaa).");
      const v = lerNumero(valor(l, "valor"));
      if (v === null || v < 0) return erro("valor", "Valor inválido.");
      const status = STATUS[valor(l, "status").toLowerCase()];
      if (!status) return erro("status", "Situação deve ser aberto, ganho ou perdido.");
      const nova: LinhaImportacao = {
        linha: n,
        codigo_shop9: codigo,
        cliente_codigo: valor(l, "cliente_codigo"),
        data,
        valor: v,
        status,
      };
      vistos.set(codigo, nova);
      linhas.push(nova);
      return;
    }

    // vendas: uma linha por nota ou por item
    // Uma linha com erro invalida a nota inteira: gravar só parte dos itens deixaria a venda errada.
    const erroNota = (campo: string, mensagem: string) => {
      notasComErro.add(codigo);
      erro(campo, mensagem);
    };
    const data = lerData(valor(l, "data_faturamento"));
    if (!data) return erroNota("data_faturamento", "Data inválida (use dd/mm/aaaa).");
    const valorNota = valor(l, "valor") ? lerNumero(valor(l, "valor")) : null;
    if (valor(l, "valor") && (valorNota === null || valorNota < 0))
      return erroNota("valor", "Valor inválido.");
    const qtd = valor(l, "quantidade") ? lerNumero(valor(l, "quantidade")) : 1;
    if (qtd === null || qtd <= 0) return erroNota("quantidade", "Quantidade inválida.");
    const valorItem = valor(l, "valor_item") ? lerNumero(valor(l, "valor_item")) : null;
    if (valor(l, "valor_item") && (valorItem === null || valorItem < 0))
      return erroNota("valor_item", "Valor do item inválido.");
    const produto = valor(l, "produto");
    const item = produto
      ? {
          produto,
          codigo_produto: valor(l, "codigo_produto"),
          quantidade: qtd,
          valor_total: valorItem ?? 0,
        }
      : null;
    const existente = vistos.get(codigo);
    if (existente) {
      if (
        existente["cliente_codigo"] !== valor(l, "cliente_codigo") ||
        existente["data_faturamento"] !== data
      )
        return erroNota("codigo_shop9", `Nota ${codigo} aparece com outro cliente ou outra data.`);
      if (item) (existente["itens"] as unknown[]).push(item);
      return;
    }
    if (valorNota === null && valorItem === null)
      return erroNota("valor", "Informe o valor da nota ou o valor de cada item.");
    const nova: LinhaImportacao = {
      linha: n,
      codigo_shop9: codigo,
      cliente_codigo: valor(l, "cliente_codigo"),
      data_faturamento: data,
      valor: valorNota,
      itens: item ? [item] : [],
    };
    vistos.set(codigo, nova);
    linhas.push(nova);
  });

  if (tipo === "vendas") {
    for (const codigo of notasComErro) {
      const nota = vistos.get(codigo);
      if (nota)
        erros.push({
          linha: nota.linha,
          campo: "codigo_shop9",
          mensagem: `Nota ${codigo} não será gravada: há linha com erro nela.`,
        });
    }
    const validas = linhas.filter((v) => !notasComErro.has(String(v["codigo_shop9"])));
    for (const v of validas) {
      const itens = v["itens"] as { valor_total: number }[];
      if (v["valor"] === null) v["valor"] = itens.reduce((s, i) => s + i.valor_total, 0);
    }
    return { linhas: validas, erros: erros.sort((a, b) => a.linha - b.linha) };
  }
  return { linhas, erros };
}

/** Campos que apontam para a mesma coluna (cada coluna deve alimentar um campo só). */
export function colunasRepetidas(tipo: TipoImportacao, mapa: Record<string, number>): string[] {
  const usadas = new Map<number, string>();
  const repetidos: string[] = [];
  for (const c of CAMPOS[tipo]) {
    const i = mapa[c.chave] ?? -1;
    if (i < 0) continue;
    if (usadas.has(i)) repetidos.push(c.rotulo);
    else usadas.set(i, c.rotulo);
  }
  return repetidos;
}
