import type { Page, Route } from "@playwright/test";

/**
 * Simula o backend (Supabase) nos testes de ponta a ponta: sessão falsa e respostas fixas.
 * Nada sai da máquina e nenhuma credencial real é usada.
 */
const PROJETO = "whzksfqyxpgulznnfsxg";
export const AUTH_ID = "00000000-0000-4000-8000-000000000001";
export const USUARIO_ID = "00000000-0000-4000-8000-000000000002";
export const EMPRESA_CF = "00000000-0000-4000-8000-0000000000c1";
export const EMPRESA_381 = "00000000-0000-4000-8000-0000000000c2";

const hoje = new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const usuario = {
  id: AUTH_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "teste@centerfrios.com",
  app_metadata: {},
  user_metadata: {},
};

const cliente = (i: number, p: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
  nome: `Cliente Teste ${i}`,
  telefone: "5582999990000",
  segmento: "Padaria",
  cidade: "Maceió",
  empresa_id: EMPRESA_CF,
  data_ultima_compra: diasAtras(5),
  compras: [diasAtras(5), diasAtras(25), diasAtras(45)],
  comprou_no_mes: false,
  ultima_interacao: null,
  ultima_interacao_qualificada: null,
  qualificada_hoje: false,
  qualificada_no_mes: false,
  orcamentos_abertos: [],
  ...p,
});

export const PAINEL = {
  faturado_mes: 42000,
  faturado_hoje: 1500,
  meta: { meta_vendas: 110000, meta_orcamentos: 18, meta_cobertura: 70, meta_reativacao: 3 },
  orcamentos_mes: 5,
  orcamentos_hoje: 1,
  pontos_hoje: 30,
  clientes: [
    cliente(1, {
      compras: [diasAtras(50), diasAtras(60), diasAtras(70)],
      data_ultima_compra: diasAtras(50),
    }),
    cliente(2, {
      orcamentos_abertos: [
        { id: "o1", valor: 9000, data: diasAtras(9), ultimo_followup: diasAtras(8) },
      ],
    }),
    cliente(3, { compras: [], data_ultima_compra: null }),
    cliente(4, {
      comprou_no_mes: true,
      qualificada_no_mes: true,
      ultima_interacao_qualificada: hoje,
    }),
  ],
};

export const CLIENTE_ID = PAINEL.clientes[0]!.id;
const CLIENTES_LISTA = PAINEL.clientes.map((c, i) => ({
  id: c.id,
  nome: c.nome,
  cidade: c.cidade,
  segmento: c.segmento,
  etiquetas: i === 0 ? ["Rede", "Inauguração"] : [],
  data_ultima_compra: c.data_ultima_compra,
  vendedor_id: USUARIO_ID,
  empresa_id: c.empresa_id,
}));
const FICHA = {
  cliente: {
    ...CLIENTES_LISTA[0],
    data_ultima_compra: diasAtras(120),
    telefone: "5582999990000",
    email: null,
    documento: null,
    codigo_shop9: "1001",
  },
  compras: [
    {
      id: "v1",
      data: diasAtras(120),
      valor: 3200,
      codigo_shop9: "NF1",
      itens: [{ produto: "Freezer horizontal 500 L", quantidade: 1, valor_total: 3200 }],
    },
    { id: "v2", data: diasAtras(60), valor: 900, codigo_shop9: "NF2", itens: [] },
  ],
  total_12m: 4100,
  qtd_12m: 2,
  ticket_medio_12m: 2050,
  itens_mais_comprados: [{ produto: "Freezer horizontal 500 L", quantidade: 1, valor_total: 3200 }],
  orcamentos: [
    {
      id: "o9",
      status: "aberto",
      data: diasAtras(9),
      valor: 9000,
      ultimo_followup: diasAtras(8),
      proximo_followup: null,
      observacao: "Aguardando aprovação do sócio",
    },
  ],
  interacoes: [
    {
      id: "i1",
      tipo: "visita",
      cliente_respondeu: true,
      resultado: "Pediu orçamento",
      data: `${diasAtras(9)}T13:00:00Z`,
      dia_local: diasAtras(9),
    },
  ],
  notas: [
    {
      id: "n1",
      texto: "Prefere entrega pela manhã.",
      autor_id: USUARIO_ID,
      autor_nome: "Clara",
      created_at: new Date().toISOString(),
    },
  ],
};

const FERIADOS = [
  {
    id: "f1",
    data: `${hoje.slice(0, 4)}-11-02`,
    nome: "Finados",
    abrangencia: "nacional",
    localidade: null,
    empresa_id: null,
    data_movel: false,
  },
  {
    id: "f2",
    data: `${hoje.slice(0, 4)}-11-20`,
    nome: "Dia Nacional de Zumbi e da Consciência Negra",
    abrangencia: "nacional",
    localidade: null,
    empresa_id: null,
    data_movel: false,
  },
];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Respostas da API REST por tabela ou função. Ajuste `extras` para cada teste. */
export async function simularBackend(page: Page, extras: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ chave, sessao }) => localStorage.setItem(chave, JSON.stringify(sessao)),
    {
      chave: `sb-${PROJETO}-auth-token`,
      sessao: {
        access_token: "falso",
        refresh_token: "falso",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: 4102444800,
        user: usuario,
      },
    },
  );

  const tabelas: Record<string, unknown> = {
    usuarios: {
      id: USUARIO_ID,
      nome: "Clara",
      apelido_copiloto: "Clarinha",
      tema: "auto",
      demo: false,
    },
    user_roles: [{ role: "vendedor" }, { role: "diretoria" }],
    empresas: [
      { id: EMPRESA_CF, nome: "CENTERFRIOS" },
      { id: EMPRESA_381, nome: "381 Distribuidora" },
    ],
    configuracoes_regras: [],
    feriados: FERIADOS,
    "rpc/painel_vendedor": PAINEL,
    clientes: CLIENTES_LISTA,
    "rpc/ficha_cliente": FICHA,
    ...extras,
  };

  await page.route(/supabase\.co\/auth\/v1\/user/, (r) => json(r, usuario));
  await page.route(/supabase\.co\/auth\/v1\//, (r) => json(r, {}));
  await page.route(/supabase\.co\/rest\/v1\//, (route) => {
    const caminho = new URL(route.request().url()).pathname.replace(/^\/rest\/v1\//, "");
    let corpo = tabelas[caminho] ?? [];
    if (route.request().method() === "POST" && caminho.startsWith("rpc/") === false) corpo = [];
    const objeto = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    if (objeto && Array.isArray(corpo)) corpo = corpo[0] ?? null;
    if (!objeto && caminho === "usuarios") corpo = [corpo];
    const cabecalhos = Array.isArray(corpo)
      ? { "Content-Range": `0-${Math.max(0, corpo.length - 1)}/${corpo.length}` }
      : {};
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cabecalhos,
      body: JSON.stringify(corpo),
    });
  });
}
