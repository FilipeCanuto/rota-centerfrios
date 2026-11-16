import { createServer } from "node:http";
import { assinar, sha256Hex, textoCanonico } from "../src/assinatura.js";

/**
 * Rota falsa para os testes: repete as regras do servidor real (src/integracoes/conectorServidor.server.ts)
 * e das funções do banco (docs/lovable/21-conector-shop9.md): HMAC + janela, nonce único, revogação,
 * fila com reserva, resultado e lotes idempotentes.
 */
export function iniciarRotaFalsa({
  conectorId,
  token,
  modo = "conector",
  ambiente = "homologacao",
  limitePorMinuto = 120,
}) {
  const db = {
    conector: { id: conectorId, token_hash: sha256Hex(token), ativo: true, versao: null },
    config: { modo, ambiente },
    nonces: new Map(),
    envios: [],
    lotes: new Map(),
    linhas: { clientes: new Map(), produtos: new Map(), vendas: new Map(), orcamentos: new Map() },
    eventos: [],
    falharProximas: 0,
  };

  const acoes = {
    heartbeat: (d) => ((db.conector.versao = d.versao), db.config),
    trabalhos: (d) => {
      const agora = Date.now();
      const livres = db.envios.filter(
        (e) => ["pendente", "erro"].includes(e.estado) && (e.reservado_ate ?? 0) < agora,
      );
      livres.slice(0, d.limite).forEach((e) => (e.reservado_ate = agora + 5 * 60_000));
      return {
        trabalhos: livres.slice(0, d.limite).map(({ estado: _e, reservado_ate: _r, ...t }) => t),
      };
    },
    resultado: (d) => {
      const e = db.envios.find((x) => x.envio_id === d.envio_id);
      if (e.estado === "enviado" && e.codigo_shop9 === d.codigo_shop9) return { ok: true }; // repetição
      Object.assign(
        e,
        d.ok
          ? { estado: "enviado", codigo_shop9: d.codigo_shop9 }
          : { estado: "erro", ultimo_erro: d.erro },
        { reservado_ate: 0 },
      );
      db.eventos.push({ tipo: "envio_orcamento", ok: d.ok, mensagem: d.erro });
      return { ok: true };
    },
    sincronizar: (d) => {
      const chave = `${conectorId}:${d.lote_id}`;
      if (db.lotes.has(chave)) return db.lotes.get(chave);
      let inseridas = 0;
      let atualizadas = 0;
      for (const l of d.linhas) {
        const k = d.tipo === "vendas" ? `${l.codigo_shop9}:${l.codigo_produto}` : l.codigo_shop9;
        db.linhas[d.tipo].has(k) ? atualizadas++ : inseridas++;
        db.linhas[d.tipo].set(k, l);
      }
      const r = { inseridas, atualizadas, ignoradas: 0, erros: [] };
      db.lotes.set(chave, r);
      return r;
    },
  };

  const servidor = createServer(async (req, res) => {
    let corpo = "";
    for await (const parte of req) corpo += parte;
    const responder = (status, dados) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(dados));
    };
    if (db.falharProximas > 0) return (db.falharProximas--, responder(503, { erro: "interno" }));
    const h = req.headers;
    const caminho = new URL(req.url, "http://x").pathname;
    const acao = caminho.replace("/api/conector/", "");
    if (h["x-conector-id"] !== conectorId || !db.conector.ativo)
      return responder(401, { erro: "autenticacao" });
    const ts = h["x-conector-ts"];
    if (!ts || Math.abs(Date.now() - Number(ts)) > 5 * 60_000)
      return responder(401, { erro: "autenticacao" });
    const esperada = assinar(
      db.conector.token_hash,
      textoCanonico(ts, h["x-conector-nonce"], req.method, caminho, corpo),
    );
    if (esperada !== h["x-conector-assinatura"]) return responder(401, { erro: "autenticacao" });
    if (db.nonces.has(h["x-conector-nonce"])) return responder(409, { erro: "repetida" });
    db.nonces.set(h["x-conector-nonce"], Date.now());
    const ultimoMinuto = [...db.nonces.values()].filter((t) => Date.now() - t < 60_000).length;
    if (ultimoMinuto > limitePorMinuto) return responder(429, { erro: "limite" });
    if (!acoes[acao]) return responder(404, { erro: "acao" });
    responder(200, acoes[acao](JSON.parse(corpo || "{}")));
  });

  return new Promise((ok) =>
    servidor.listen(0, "127.0.0.1", () =>
      ok({
        url: `http://127.0.0.1:${servidor.address().port}`,
        db,
        fechar: () => new Promise((f) => servidor.close(f)),
      }),
    ),
  );
}
