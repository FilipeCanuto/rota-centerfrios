import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Quarta-feira, 10h em Maceió: dentro do expediente e fora dos feriados simulados. */
const EXPEDIENTE = new Date("2026-11-11T13:00:00Z");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const mascote = (page: Page) => page.getByRole("button", { name: /Menu do mascote Clarinha/ });
const caixa = (page: Page) => page.locator(".mascote-flutuante");
const balao = (page: Page) => page.locator(".mascote-balao");

async function abrir(page: Page, { baloes = false, url = "/inicio" } = {}) {
  await page.clock.setFixedTime(EXPEDIENTE);
  await simularBackend(page, {}, { baloes });
  await page.goto(url);
  await expect(mascote(page)).toBeVisible();
}

async function dentroDaTela(page: Page) {
  const b = (await caixa(page).boundingBox())!;
  const v = page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height);
  return b;
}

test("fala no balão, registra no sino, passa no axe e fecha com Esc", async ({ page }) => {
  const sino = page.waitForRequest(
    (r) => r.url().includes("rpc/registrar_notificacoes") && !!r.postData()?.includes("mascote:"),
  );
  await abrir(page, { baloes: true });
  await expect(balao(page)).toContainText("Clarinha aqui");
  await sino;
  await dentroDaTela(page);
  const texto = (await balao(page).locator("p").innerText()).trim();
  expect(texto.length).toBeLessThanOrEqual(100);
  expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(balao(page)).toBeHidden();
});

test("fora do expediente descansa e não abre balão comum", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-08T13:00:00Z")); // domingo
  await simularBackend(page, {}, { baloes: true });
  await page.goto("/gestao");
  await expect(
    page.getByRole("button", { name: /Menu do mascote Clarinha\. Descansando/ }),
  ).toBeVisible();
  await expect(balao(page)).toBeHidden();
});

test("arrastar encaixa no canto mais próximo, sem sair da tela, e lembra a posição", async ({
  page,
}) => {
  await abrir(page);
  await expect(caixa(page)).toHaveAttribute("data-canto", "inferior-direito");
  const b = (await mascote(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(-400, -400, { steps: 8 }); // tenta levar para fora da tela
  await dentroDaTela(page);
  await page.mouse.move(30, 120, { steps: 4 });
  await page.mouse.up();
  await expect(caixa(page)).toHaveAttribute("data-canto", "superior-esquerdo");
  await expect(page.getByRole("menu")).toBeHidden(); // arrastar não abre o menu
  await dentroDaTela(page);
  await page.reload();
  await expect(caixa(page)).toHaveAttribute("data-canto", "superior-esquerdo");
});

test("giro do aparelho e barra inferior: sempre na tela e acima da navegação", async ({ page }) => {
  await abrir(page);
  const barra = page.locator("nav.fixed.bottom-0");
  if (await barra.isVisible()) {
    const m = await dentroDaTela(page);
    expect(m.y + m.height).toBeLessThanOrEqual((await barra.boundingBox())!.y);
  }
  const v = page.viewportSize()!;
  await page.setViewportSize({ width: v.height, height: v.width }); // gira
  await dentroDaTela(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await dentroDaTela(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("teclado: menu move de canto, minimiza e restaura", async ({ page }) => {
  await abrir(page);
  await mascote(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(TAGS).disableRules(["aria-hidden-focus"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("menuitemradio", { name: "Canto superior esquerdo" }).press("Enter");
  await expect(caixa(page)).toHaveAttribute("data-canto", "superior-esquerdo");
  await expect(page.getByRole("menu")).toBeHidden(); // espera o menu fechar antes de reabrir
  await mascote(page).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Minimizar" }).press("Enter");
  const bolinha = page.getByRole("button", { name: "Mostrar o mascote Clarinha" });
  await expect(bolinha).toBeVisible();
  await dentroDaTela(page);
  await bolinha.press("Enter");
  await expect(mascote(page)).toBeVisible();
});

test("encolhe sozinho ao digitar e com modal aberto", async ({ page }) => {
  await abrir(page, { url: "/links" });
  const bolinha = page.getByRole("button", { name: "Mostrar o mascote Clarinha" });
  await page.getByRole("button", { name: /Ver detalhes de Catálogo de freezers/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".mascote-botao")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(mascote(page)).toBeVisible();
  await page.goto("/clientes");
  await page.getByRole("searchbox").first().focus();
  await expect(bolinha).toBeVisible();
});

test("movimento reduzido: pose estática, balão continua", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrir(page, { baloes: true });
  await expect(balao(page)).toContainText("Clarinha aqui");
  await expect(mascote(page).locator("svg")).not.toHaveAttribute("data-animado");
});

test("se o mascote falhar, o app segue funcionando sem ele", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  // Só o mascote lê este dado do aparelho: fazê-lo falhar derruba o mascote e mais nada.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      get() {
        throw new Error("falha simulada do mascote");
      },
    }),
  );
  await page.clock.setFixedTime(EXPEDIENTE);
  await simularBackend(page, {}, { baloes: true });
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Clara" })).toBeVisible();
  await expect(caixa(page)).toHaveCount(0);
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
  expect(erros).toEqual([]);
});
