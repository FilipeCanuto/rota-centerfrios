import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLIENTE_ID, simularBackend } from "./simulacao";

/** Todas as telas, verificadas com axe (WCAG 2.2 AA) em cada projeto (celular/desktop × claro/escuro). */
const ROTAS = [
  { url: "/auth", titulo: "Entrar na Rota", logado: false },
  { url: "/redefinir-senha", titulo: "Crie uma nova senha", logado: false },
  { url: "/design-system", titulo: "Design system Polar", logado: false },
  { url: "/pagina-que-nao-existe", titulo: "404", logado: false },
  { url: "/inicio", titulo: "Olá, Clara", logado: true },
  { url: "/conversas", titulo: "Conversas", logado: true },
  { url: "/clientes", titulo: "Clientes", logado: true },
  { url: `/clientes/${CLIENTE_ID}`, titulo: "Cliente Teste 1", logado: true },
  { url: "/agenda", titulo: "Agenda", logado: true },
  { url: "/orcamentos", titulo: "Orçamentos", logado: true },
  { url: "/links", titulo: "Links e arquivos", logado: true },
  { url: "/gamificacao", titulo: "Pontos e selos", logado: true },
  { url: "/mais", titulo: "Mais", logado: true },
  { url: "/configuracoes/importacao", titulo: "Importar planilhas do Shop9", logado: true },
  { url: "/configuracoes/feriados", titulo: "Feriados e dias sem expediente", logado: true },
];

/** Roda o axe na página como está agora e falha listando o que encontrou. */
async function semViolacoes(page: Page, { modal = false } = {}) {
  const axe = new AxeBuilder({ page });
  // Com modal aberto, o Radix esconde o fundo (aria-hidden) e prende o foco no diálogo:
  // o fundo não é alcançável, então "aria-hidden-focus" seria um falso positivo.
  if (modal) axe.disableRules(["aria-hidden-focus"]);
  const resultado = await axe
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    resultado.violations.map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    ),
  ).toEqual([]);
}

async function semRolagemLateral(page: Page) {
  const [conteudo, janela] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(conteudo).toBeLessThanOrEqual(janela);
}

test.beforeEach(async ({ page }) => {
  // Nada sai da máquina: sem sessão simulada, o backend responde vazio.
  await page.route(/supabase\.co/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
});

for (const rota of ROTAS) {
  test(`${rota.url} passa no axe, tem um único h1 e cabe na tela`, async ({ page }, info) => {
    if (rota.logado) await simularBackend(page);
    await page.goto(rota.url);
    await expect(page.getByRole("heading", { level: 1, name: rota.titulo })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    // Garante que o tema pedido foi aplicado (senão o claro seria testado duas vezes).
    if (info.project.use.colorScheme === "dark")
      await expect(page.locator("html")).toHaveClass(/dark/);
    else await expect(page.locator("html")).not.toHaveClass(/dark/);
    await semRolagemLateral(page);
    await semViolacoes(page);
    // Reflow a 320 px (WCAG 1.4.10), só nos projetos de celular.
    if ((info.project.use.viewport?.width ?? 0) < 768) {
      await page.setViewportSize({ width: 320, height: 720 });
      await semRolagemLateral(page);
    }
  });
}

test("componentes abertos passam no axe: busca, notificações, menu e tabela", async ({ page }) => {
  // Sem animação de entrada: o axe mediria o contraste no meio do esmaecimento.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await simularBackend(page);
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /Buscar/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await semViolacoes(page, { modal: true });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Notificações/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await semViolacoes(page, { modal: true });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await semViolacoes(page, { modal: true });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Ver como tabela" }).first().click();
  await expect(page.getByRole("table").first()).toBeVisible();
  await semViolacoes(page);
});

test("navegação só com teclado: o primeiro Tab mostra Pular para o conteúdo", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  const link = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo")).toBeFocused();
});
