/**
 * Shop9 → linhas da Rota (docs/shop9-mapeamento.md). Funções puras, sem rede.
 * Dinheiro sai em centavos inteiros; códigos sempre como texto.
 */
const txt = (v) => (v == null ? "" : String(v).trim());
export const centavos = (reais) => Math.round(Number(reais || 0) * 100);
const cod = (v) => (Number(v) > 0 || (txt(v) && txt(v) !== "0") ? txt(v) : null);

export const funcionario = (f) => ({
  codigo_shop9: txt(f.codigo),
  nome: txt(f.apelido) || txt(f.nome),
  email: txt(f.email).toLowerCase() || null,
  vendedor: !!f.vendedor,
  ativo: !f.inativo,
});

export const cliente = (c) => ({
  codigo_shop9: txt(c.codigo),
  nome: txt(c.nome) || txt(c.fantasia),
  documento: txt(c.cpfCnpj).replace(/\D/g, "") || null,
  telefone: txt(c.telefone1) || txt(c.telefone2) || null,
  cidade: [txt(c.cidade), txt(c.uf)].filter(Boolean).join("/") || null,
  vendedor_codigo: cod(c.vendedor1?.codigo),
  limite_credito_centavos: centavos(c.limiteCredito),
  credito_validade: txt(c.dataValidadeCredito).slice(0, 10) || null,
  bloqueado: !!c.bloqueado,
  ativo: !c.inativo,
});

/** Preço da tabela configurada na Rota; sem ela, a primeira tabela com preço > 0. */
export function produto(p, tabela) {
  const precos = p.precos ?? [];
  const alvo = tabela
    ? precos.find((x) => txt(x.tabela).toUpperCase() === tabela.toUpperCase())
    : precos.find((x) => Number(x.preco) > 0);
  return {
    codigo_shop9: txt(p.codigo),
    descricao: txt(p.nome),
    unidade: txt(p.nomeUnidadeVendas).toUpperCase() || "UN",
    preco_tabela: (centavos(alvo?.preco) / 100).toFixed(2),
    ativo: !p.inativo && !p.bloquearVenda,
  };
}

/** /v3/precos: um registro por produto com a lista de tabelas; só a tabela configurada interessa. */
export const precos = (r, tabela) =>
  (r.precos ?? [])
    .filter((x) => txt(x.tabela).toUpperCase() === txt(tabela).toUpperCase())
    .map((x) => ({
      codigo_shop9: txt(x.codigo_Prod_Serv || r.codigo),
      preco_centavos: centavos(x.preco_Original),
    }));

export const estoque = (r, codfilial) => ({
  codigo_shop9: txt(r.codigo),
  quantidade: (r.estoqueFiliais ?? [])
    .filter((e) => String(e.codigoFilial) === String(codfilial))
    .reduce((s, e) => s + Number(e.estoqueAtual || 0), 0),
});

export const credito = (r) => ({
  codigo_shop9: txt(r.codigoCliFor),
  saldo_centavos: centavos(r.saldo),
});

// shortcut: o exemplo da documentação vem vazio; nomes supostos (codigo/descricao/ativo). Ajustar com a Idealsoft.
export const motivoDesconto = (r) => ({
  codigo_shop9: txt(r.codigo),
  descricao: txt(r.descricao ?? r.nome),
  ativo: !r.inativo,
});

/**
 * Divide o valor entre os vendedores. Cada item vai para o seu vendedor_1; se tiver vendedor_2, metade para
 * cada um. Sem vendedor no item, vale o da saída. O total distribuído é sempre exatamente `total_centavos`
 * (sobra de arredondamento pelo maior resto, empate para o vendedor_1).
 */
export function dividirVenda(s, totalCentavos = centavos(s.total_Com_Desconto)) {
  const v1 = cod(s.codigo_Vendedor_1);
  const v2 = cod(s.codigo_Vendedor_2);
  const pesos = new Map();
  const somar = (k, p) => pesos.set(k, (pesos.get(k) ?? 0) + p);
  const itens = s.produtos ?? [];
  for (const i of itens) {
    const p = Number(i.preco_Final_Com_Desconto ?? i.preco_Final ?? 0);
    const a = cod(i.codigo_Vendedor_1) ?? v1;
    const b = cod(i.codigo_Vendedor_2) ?? (cod(i.codigo_Vendedor_1) ? null : v2);
    if (b && b !== a) {
      somar(a, p / 2);
      somar(b, p / 2);
    } else somar(a, p);
  }
  if (![...pesos.values()].some((p) => p > 0)) {
    pesos.clear();
    if (v2 && v2 !== v1) (somar(v1, 1), somar(v2, 1));
    else somar(v1, 1);
  }
  const soma = [...pesos.values()].reduce((x, y) => x + y, 0);
  const partes = [...pesos].map(([vendedor, p], ordem) => {
    const exato = (totalCentavos * p) / soma;
    return { vendedor_codigo: vendedor, valor_centavos: Math.floor(exato), resto: exato % 1, ordem };
  });
  let falta = totalCentavos - partes.reduce((x, p) => x + p.valor_centavos, 0);
  for (const p of [...partes].sort((a, b) => b.resto - a.resto || a.ordem - b.ordem)) {
    if (falta <= 0) break;
    p.valor_centavos++;
    falta--;
  }
  return partes.map(({ vendedor_codigo, valor_centavos }) => ({ vendedor_codigo, valor_centavos }));
}

/**
 * Saída → venda da Rota. `faturada` = efetivada no financeiro e não desfeita; só ela conta na meta.
 * `data_faturamento` só vem da passada por data de efetivação (tipodata=E); na passada por alteração vai nulo
 * e o banco mantém a data já gravada.
 */
export const venda = (s, dataEfetivacao = null) => ({
  codigo_shop9: txt(s.ordem),
  cliente_codigo: txt(s.codigo_Cliente),
  faturada: !!s.efetivadoFinanceiro && !s.desefetivadoFinanceiro,
  data_faturamento: dataEfetivacao,
  data_emissao: txt(s.data).slice(0, 10) || null,
  partes: dividirVenda(s),
  itens: (s.produtos ?? []).map((i) => ({
    codigo_produto: txt(i.codigo),
    quantidade: Number(i.quantidade || 0),
    valor_centavos: centavos(i.preco_Final_Com_Desconto ?? i.preco_Final),
  })),
});

// shortcut: a documentação não mostra os campos da devolução; supomos o formato da saída. Ajustar com a Idealsoft.
export const devolucao = (d, dataEfetivacao = null) => ({
  ...venda({ ...d, efetivadoFinanceiro: d.efetivadoFinanceiro ?? true }, dataEfetivacao),
  saida_origem: cod(d.ordem_Saida ?? d.ordemSaida ?? d.ordem_Saida_Origem),
});
