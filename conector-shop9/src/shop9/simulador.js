import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { assinarShop9 } from "./cliente.js";
import { dataHora } from "./adaptador.js";

/**
 * Simulador do módulo Integrações (só teste; dados fictícios em memória), fiel à documentação:
 * HTTP 200 sempre com envelope, /auth com token por filial e expireAt, Signature HMAC conferida,
 * paginação de 20 até FIM_DE_PAGINA, filtros tipodata/datade/dataate/tiposoperacao e erros tipados.
 * Ganchos de teste: `expirarTokens()`, `licencaInvalida`, `perderRespostaDoProximoPost`.
 */
const POR_PAGINA = 20;
const env = (dados) => ({ sucesso: true, mensagem: null, tipo: null, complementoTipo: null, statusCode: 200, dados });
const erro = (tipo, statusCode, mensagem) => ({ sucesso: false, mensagem, tipo, complementoTipo: "", statusCode, dados: null });
const brParaIso = (s) => (/^\d{2}-\d{2}-\d{4}$/.test(s) ? s.split("-").reverse().join("-") : s);

export function iniciarSimulador({ serie = "SIM-0001", senha = "senha-simulador", filiais = ["1"], porta = 0 } = {}) {
  const agoraTxt = () => dataHora(new Date());
  /** Cada registro guarda datas internas: _cri (criação), _alt (alteração), _efe (efetivação). */
  const marca = (r, efetivado = false) => {
    const t = agoraTxt();
    return Object.assign(r, { _cri: r._cri ?? t, _alt: t, _efe: efetivado ? t : r._efe ?? null });
  };
  const dados = {
    funcionarios: [marca({ codigo: 6, nome: "Vendedora Um", apelido: "Ana", email: "ana@exemplo.test", vendedor: true, inativo: false, codigoFilial: 1 })],
    clientes: [marca({ codigo: 5175, nome: "Padaria Exemplo", fantasia: "", cpfCnpj: "12.345.678/0001-95", cidade: "Maceió", uf: "AL", telefone1: "(82) 99999-0000", vendedor1: { codigo: 6 }, limiteCredito: 600, inativo: false })],
    produtos: [marca({ codigo: "20098", nome: "Freezer horizontal 400 L", nomeUnidadeVendas: "un", inativo: false, bloquearVenda: false, precos: [{ tabela: "VAREJISTA", preco: 3500, promocional: false }] })],
    "v3/precos": [],
    "v2/estoque": [marca({ codigo: "20098", estoqueFiliais: [{ codigoFilial: 1, estoqueAtual: 7 }] })],
    saidas: [],
    devolucao: [],
    "credito/cliente/saldos": [],
    motivos_desconto: [],
  };
  const tokens = new Map(); // token → { filial, expira }
  const ganchos = { licencaInvalida: false, perderRespostaDoProximoPost: false };
  let ordem = 21000;

  function filtrar(lista, q) {
    const de = brParaIso(q.get("datade") ?? "");
    const ate = brParaIso(q.get("dataate") ?? q.get("dataAte") ?? "");
    const campo = { C: "_cri", E: "_efe" }[q.get("tipodata")] ?? "_alt";
    const ops = q.get("tiposoperacao")?.split(",");
    const noDia = (v, lim, fim) => (lim.length === 10 ? (fim ? v.slice(0, 10) <= lim : v.slice(0, 10) >= lim) : fim ? v <= lim : v >= lim);
    return lista.filter((r) => (!de || (r[campo] && noDia(r[campo], de, false))) && (!ate || (r[campo] && noDia(r[campo], ate, true))) && (!ops || ops.includes(r.tipo_Operacao)));
  }
  const publico = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")));

  function autenticar(req, corpo) {
    const t = tokens.get(String(req.headers.authorization ?? "").replace(/^Token /, ""));
    if (!t || t.expira < Date.now() || t.filial !== String(req.headers.codfilial)) return false;
    const esperada = Buffer.from(assinarShop9(senha, req.method, String(req.headers.timestamp ?? ""), corpo));
    const recebida = Buffer.from(String(req.headers.signature ?? ""));
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  }

  function criarSaida(o) {
    if (!dados.clientes.some((c) => String(c.codigo) === String(o.codigoCliente)))
      return erro("CAMPO_INVALIDO", 400, "O parâmetro 'codigoCliente' é inválido. Para mais informações consulte o manual de integração.");
    if (!Array.isArray(o.produtos) || !o.produtos.length) return erro("BODY_INVALIDO", 400, "Corpo inválido.");
    const produtos = o.produtos.map((p, i) => ({ ordem: ++ordem * 10 + i, codigo: p.codigo, quantidade: p.quantidade, preco_Unitario: p.precoUnitario, preco_Final: p.quantidade * p.precoUnitario, preco_Final_Com_Desconto: p.quantidade * (p.precoUnitario - p.descontoUnitario), codigo_Vendedor_1: o.codigoVendedor_1, codigo_Vendedor_2: 0 }));
    dados.saidas.push(marca({
      ordem: ++ordem, tipo_Operacao: "ORC", codigoOperacao: Number(o.codigoOperacao), codigo_Cliente: Number(o.codigoCliente),
      codigo_Vendedor_1: o.codigoVendedor_1, codigo_Vendedor_2: 0, data: o.data, observacao: o.observacao ?? "",
      referenciaInterna: o.ReferenciaInterna ?? "", produtos,
      total_Com_Desconto: Math.round(produtos.reduce((s, p) => s + p.preco_Final_Com_Desconto, 0) * 100) / 100,
      efetivadoEstoque: false, efetivadoFinanceiro: false, desefetivadoEstoque: false, desefetivadoFinanceiro: false,
    }));
    return env("Registro criado com sucesso.");
  }

  const servidor = createServer(async (req, res) => {
    let corpo = "";
    for await (const parte of req) corpo += parte;
    const url = new URL(req.url, "http://simulador");
    const responder = (e) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(e));
    };
    if (url.pathname === "/auth/" || url.pathname === "/auth") {
      const filial = url.searchParams.get("codfilial");
      if (url.searchParams.get("serie") !== serie || !filiais.includes(filial))
        return responder(erro("AUTENTICACAO_INVALIDA", 401, "Série ou filial inválida."));
      if (ganchos.licencaInvalida) return responder(erro("LICENCA_EXPIRADA_OU_INVALIDA", 401, "Licença expirada."));
      const token = randomBytes(16).toString("hex");
      const expira = Date.now() + 60 * 60_000;
      tokens.set(token, { filial, expira });
      return responder(env({ token, expireAt: new Date(expira).toISOString().replace("Z", "0000+00:00") }));
    }
    if (!autenticar(req, corpo)) return responder(erro("AUTENTICACAO_INVALIDA", 401, "Token ou assinatura inválidos."));

    if (req.method === "POST" && url.pathname === "/saidas") {
      let o;
      try {
        o = JSON.parse(corpo);
      } catch {
        return responder(erro("BODY_INVALIDO", 400, "JSON inválido."));
      }
      const r = criarSaida(o);
      if (r.sucesso && ganchos.perderRespostaDoProximoPost) {
        ganchos.perderRespostaDoProximoPost = false;
        return req.socket.destroy(); // criou, mas a resposta se perdeu (tempo esgotado do lado do conector)
      }
      return responder(r);
    }
    if (req.method === "GET" && url.pathname === "/motivos_desconto")
      return responder(env(filtrar(dados.motivos_desconto, url.searchParams).map(publico)));
    const m = url.pathname.match(/^\/(.+)\/(\d+)\/?$/);
    if (req.method === "GET" && m && dados[m[1]]) {
      const lista = filtrar(dados[m[1]], url.searchParams);
      const pagina = lista.slice((Number(m[2]) - 1) * POR_PAGINA, Number(m[2]) * POR_PAGINA);
      if (!pagina.length) return responder(erro("FIM_DE_PAGINA", 417, "Fim de página."));
      return responder(env(m[1] === "v3/precos" ? publico(pagina[0]) : pagina.map(publico)));
    }
    responder(erro("REGISTRO_NAO_ENCONTRADO", 404, "Registro não encontrado."));
  });

  return new Promise((ok) =>
    servidor.listen(porta, "127.0.0.1", () =>
      ok({
        url: `http://127.0.0.1:${servidor.address().port}`,
        serie,
        senha,
        dados,
        marca,
        ganchos,
        expirarTokens: () => tokens.clear(),
        fechar: () => new Promise((f) => (servidor.closeAllConnections?.(), servidor.close(f))),
      }),
    ),
  );
}

// `npm run simulador`: sobe na porta 9009 para testar o conector instalado.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const s = await iniciarSimulador({ porta: 9009 });
  console.log(`Simulador do Shop9 em ${s.url} (série ${s.serie}, filial 1)`);
}
