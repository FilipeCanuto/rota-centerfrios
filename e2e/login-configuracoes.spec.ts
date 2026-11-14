import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simularBackend } from "./simulacao";

const ADMIN = [{ role: "administrador" }];
const ARTE = (cor: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="#0b1f44"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/></svg>`;
const linha = (id: string, ordem: number, texto: string, ativo = true) => ({
  id,
  arquivo_path: `${id}.svg`,
  tipo: "imagem",
  texto_alternativo: texto,
  ordem,
  ativo,
  criado_por: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
});
const MIDIAS = [linha("m1", 0, "Loja CENTERFRIOS"), linha("m2", 1, "Equipe em Maceió")];

/** Links assinados e arquivos do bucket simulados: nada sai da máquina. */
async function simularStorage(page: Page) {
  await page.route(/\/storage\/v1\/object\/sign\/midia-login\//, (r) => {
    if (r.request().method() === "POST") {
      const caminho = new URL(r.request().url()).pathname.split("/midia-login/")[1];
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedURL: `/object/sign/midia-login/${caminho}?token=t` }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: ARTE(r.request().url().includes("m2") ? "#c9a227" : "#1b4fa0"),
    });
  });
}

async function simularLogin(page: Page, midias: unknown[]) {
  await page.route(/supabase\.co\/auth\/v1\//, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route(/supabase\.co\/rest\/v1\/midia_login/, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(midias),
    }),
  );
  await simularStorage(page);
}

const largura = (page: Page) => page.viewportSize()?.width ?? 0;

test("login sem mídia: palco da marca, nunca vazio, e o formulário vem primeiro", async ({
  page,
}) => {
  await simularLogin(page, []);
  await page.goto("/auth");
  const palco = page.getByTestId("palco-login");
  // Primeira carga no servidor de desenvolvimento: o trecho do palco e a imagem demoram.
  await expect(palco.getByRole("img", { name: "CENTERFRIOS" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Entrar na Rota" })).toBeVisible();
  // O formulário vem antes do palco no DOM: a tabulação e o leitor de tela começam nele.
  const formularioAntes = await page.evaluate(() => {
    const f = document.querySelector("form");
    const p = document.querySelector('[data-testid="palco-login"]');
    return !!f && !!p && !!(f.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(formularioAntes).toBe(true);
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toHaveCount(0);
  if (largura(page) >= 1024) {
    const [p, m] = await Promise.all([palco.boundingBox(), page.locator("main").boundingBox()]);
    expect(p!.x).toBeLessThan(20);
    expect(p!.width / m!.width).toBeGreaterThan(0.55);
    expect(p!.width / m!.width).toBeLessThan(0.6);
  }
});

test("login com mídias: imagem, pontos, pausar e troca a cada 12 s", async ({ page }) => {
  await page.clock.install();
  await simularLogin(page, MIDIAS);
  await page.goto("/auth");
  const palco = page.getByTestId("palco-login");
  await expect(palco.getByRole("img", { name: "Loja CENTERFRIOS" })).toBeVisible();
  await expect(palco.getByRole("button", { name: /Mostrar imagem/ })).toHaveCount(2);
  await page.clock.fastForward(12_500);
  await expect(palco.getByRole("img", { name: "Equipe em Maceió" })).toBeVisible();
  // Pausado, não troca mais.
  await palco.getByRole("button", { name: "Pausar apresentação" }).click();
  await expect(palco.getByRole("button", { name: "Retomar apresentação" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.clock.fastForward(30_000);
  await expect(palco.getByRole("img", { name: "Equipe em Maceió" })).toBeVisible();
  await expect(palco.getByRole("img", { name: "Loja CENTERFRIOS" })).toHaveCount(0);
  await palco.getByRole("button", { name: "Mostrar imagem 1 de 2" }).click();
  await expect(palco.getByRole("img", { name: "Loja CENTERFRIOS" })).toBeVisible();
});

test("login com movimento reduzido começa pausado e passa no axe com mídia", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await simularLogin(page, MIDIAS);
  await page.goto("/auth");
  const palco = page.getByTestId("palco-login");
  await expect(palco.getByRole("button", { name: "Retomar apresentação" })).toBeVisible();
  await expect(palco.getByRole("img", { name: "Loja CENTERFRIOS" })).toBeVisible();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("Configurações: só administrador; aba Mídia do login lista, valida, ordena e confirma exclusão", async ({
  page,
}) => {
  await simularBackend(page, { user_roles: ADMIN, midia_login: MIDIAS });
  await simularStorage(page);
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Mídia do login", selected: true })).toBeVisible();
  const lista = page.getByRole("list", { name: /Mídias do login/ });
  await expect(lista.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Prévia do login" })).toBeVisible();
  await expect(page.getByText("16:10 ou 16:9").first()).toBeVisible();

  // Primeiro não sobe; último não desce.
  await expect(page.getByRole("button", { name: "Subir: Loja CENTERFRIOS" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Descer: Equipe em Maceió" })).toBeDisabled();

  // Formato e peso são recusados antes de enviar.
  await page.getByLabel("Arquivo").setInputFiles({
    name: "doc.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "Formato não aceito" })).toBeVisible();
  await page.getByLabel("Arquivo").setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert").filter({ hasText: "O limite é 5 MB" })).toBeVisible();
  // Texto alternativo é obrigatório.
  await page.getByLabel("Arquivo").setInputFiles({
    name: "ok.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(1024),
  });
  await page.getByRole("button", { name: "Enviar mídia" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "texto alternativo" })).toBeVisible();

  // Exclusão pede confirmação.
  await page.getByRole("button", { name: "Excluir: Loja CENTERFRIOS" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("não pode ser desfeita");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(lista.getByRole("listitem")).toHaveCount(2);
});

test("Configurações recusa quem não é administrador nem diretoria", async ({ page }) => {
  await simularBackend(page, { user_roles: [{ role: "vendedor" }] });
  await page.goto("/configuracoes");
  await expect(page.getByText("Só administradores e diretoria acessam")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("Mais mostra o atalho Configurações só para administrador", async ({ page }) => {
  await simularBackend(page, { user_roles: ADMIN });
  await page.goto("/mais");
  await page.locator("main").getByRole("link", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/\/configuracoes\?aba=midia-login/);
});
