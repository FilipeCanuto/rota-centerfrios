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
    clientes: [],
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
    return json(route, corpo);
  });
}
