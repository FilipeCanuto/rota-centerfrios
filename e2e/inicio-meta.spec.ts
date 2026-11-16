import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

test("Início: hierarquia, barra da meta do mês, tabela e axe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await simularBackend(page);
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Ordem aprovada dos cartões.
  const titulos = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(titulos.filter((t) => !t.includes("Simular")).slice(0, 4)).toEqual([
    "O que fazer agora",
    "Meta do mês",
    "Metas do dia",
    "Cobertura da carteira",
  ]);
  // Cartão antigo do Pinguim e o botão Ouvir saíram.
  await expect(page.getByRole("region", { name: "Copiloto" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ouvir" })).toHaveCount(0);

  const barra = page.getByRole("img", { name: /Meta do mês: \d+% atingido/ });
  await expect(barra).toBeVisible();
  await expect(page.getByText(/Abaixo do ritmo|No ritmo|Meta batida/).first()).toBeVisible();

  const botao = page.getByRole("button", { name: "Ver tabela" });
  await expect(botao).toHaveAttribute("aria-expanded", "false");
  await botao.click();
  await expect(page.getByRole("button", { name: "Ocultar tabela" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("table", { name: "Meta do mês em tabela" })).toBeVisible();

  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);

  // Sem rolagem lateral.
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(largura).toBeLessThanOrEqual(0);
});

test("Personalizar o copiloto fica nas preferências do cabeçalho", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/inicio");
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Personalizar o copiloto" }).click();
  await expect(page.getByRole("dialog", { name: "Personalizar o copiloto" })).toBeVisible();
});
