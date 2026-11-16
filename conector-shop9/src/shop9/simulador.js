import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

/**
 * Simulador do módulo Integrações do Shop9 (só para teste; dados fictícios, em memória).
 * Segue o formato SUPOSTO do adaptador; quando a documentação chegar, ajuste os dois juntos.
 */
export function iniciarSimulador({
  serie = "SIM-0001",
  senha = "senha-simulador",
  porta = 0,
} = {}) {
  let seq = 0;
  const marca = (r) => ({ ...r, _seq: ++seq });
  const dados = {
    clientes: [
      marca({
        Codigo: "C1",
        RazaoSocial: "Padaria Exemplo",
        Fone: "82999990000",
        CpfCnpj: "00000000000191",
        Email: "contato@exemplo.test",
        Segmento: "Padaria",
        Cidade: "Maceió",
        EmailVendedor: "vendedor@exemplo.test",
      }),
    ],
    produtos: [
      marca({
        Codigo: "P1",
        Descricao: "Freezer horizontal 400 L",
        Unidade: "UN",
        Preco: 3500,
        Ativo: true,
      }),
    ],
    vendas: [
      marca({
        NumeroNota: "NF-1",
        CodigoCliente: "C1",
        DataFaturamento: "2026-11-10",
        ValorTotal: 3500,
        DescricaoProduto: "Freezer horizontal 400 L",
        CodigoProduto: "P1",
        Quantidade: 1,
        ValorItem: 3500,
      }),
    ],
    orcamentos: [],
  };
  const porChave = new Map();

  function autenticado(req, caminho) {
    const ts = Number(req.headers["x-shop9-timestamp"]);
    if (req.headers["x-shop9-serie"] !== serie || Math.abs(Date.now() / 1000 - ts) > 300)
      return false;
    const esperada = createHmac("sha256", senha).update(`${ts}${caminho}`).digest();
    const recebida = Buffer.from(String(req.headers["x-shop9-signature"] ?? ""), "hex");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  }

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, "http://simulador");
    const responder = (status, corpo) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(corpo));
    };
    if (!autenticado(req, url.pathname)) return responder(401, { mensagem: "Assinatura inválida" });
    if (req.method === "GET" && url.pathname === "/status") return responder(200, { ok: true });

    if (req.method === "POST" && url.pathname === "/orcamentos") {
      let corpo = "";
      for await (const parte of req) corpo += parte;
      const o = JSON.parse(corpo);
      if (porChave.has(o.ChaveExterna))
        return responder(200, { Numero: porChave.get(o.ChaveExterna) });
      if (!dados.clientes.some((c) => c.Codigo === o.CodigoCliente))
        return responder(422, { mensagem: "Cliente não cadastrado no Shop9" });
      const numero = `ORC-${porChave.size + 1}`;
      porChave.set(o.ChaveExterna, numero);
      const total = o.Itens.reduce(
        (s, i) => s + i.Quantidade * i.PrecoUnitario * (1 - i.DescontoPct / 100),
        0,
      );
      dados.orcamentos.push(
        marca({
          Numero: numero,
          CodigoCliente: o.CodigoCliente,
          Data: o.Data,
          ValorTotal: Math.round(total * 100) / 100,
          Situacao: "aberto",
        }),
      );
      return responder(201, { Numero: numero });
    }

    const tipo = url.pathname.slice(1);
    if (req.method === "GET" && dados[tipo]) {
      const desde = Number(url.searchParams.get("desde") || 0);
      const limite = Number(url.searchParams.get("limite") || 500);
      const novos = dados[tipo].filter((r) => r._seq > desde);
      const pagina = novos.slice(0, limite);
      return responder(200, {
        Itens: pagina,
        Cursor: String(pagina.at(-1)?._seq ?? desde),
        Mais: novos.length > limite,
      });
    }
    responder(404, { mensagem: "Não encontrado" });
  });

  return new Promise((ok) =>
    servidor.listen(porta, "127.0.0.1", () =>
      ok({
        url: `http://127.0.0.1:${servidor.address().port}`,
        serie,
        senha,
        dados,
        marca,
        fechar: () => new Promise((f) => servidor.close(f)),
      }),
    ),
  );
}

// `npm run simulador`: sobe na porta 9009 para testar o conector instalado.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const s = await iniciarSimulador({ porta: 9009 });
  console.log(`Simulador do Shop9 em ${s.url} (série ${s.serie})`);
}
