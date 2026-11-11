import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Todas as telas, verificadas com axe (WCAG 2.2 AA) em cada projeto (celular/desktop × claro/escuro). */
const ROTAS = [
  { url: "/auth", titulo: "Entrar na Rota", logado: false },
  { url: "/design-system", titulo: "Design system Polar", logado: false },
  { url: "/redefinir-senha", titulo: "Crie uma nova senha", logado: false },
  { url: "/inicio", titulo: "Olá, Clara", logado: true },
  { url: "/conversas", titulo: "Conversas", logado: true },
  { url: "/clientes", titulo: "Clientes", logado: true },
  { url: "/agenda", titulo: "Agenda", logado: true },
  { url: "/mais", titulo: "Mais", logado: true },
  { url: "/configuracoes/feriados", titulo: "Feriados e dias sem expediente", logado: true },
];

for (const rota of ROTAS) {
  test(`${rota.url} passa no axe e tem um único h1`, async ({ page }) => {
    if (rota.logado) await simularBackend(page);
    await page.goto(rota.url);
    await expect(page.getByRole("heading", { level: 1, name: rota.titulo })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    // Sem rolagem horizontal (reflow a 360 px).
    const larguras = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(larguras[0]).toBeLessThanOrEqual(larguras[1]);
    const resultado = await new AxeBuilder({ page })
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
  });
}

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
