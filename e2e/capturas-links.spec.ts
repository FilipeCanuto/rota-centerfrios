import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Capturas da tela de links para relatório. Só roda com CAPTURA=antes|depois. */
const etapa = process.env.CAPTURA;

test("captura de Links e arquivos", async ({ page }, info) => {
  test.skip(!etapa, "defina CAPTURA=antes ou CAPTURA=depois");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await simularBackend(page);
  await page.goto("/links");
  await expect(page.getByRole("heading", { level: 1, name: "Links e arquivos" })).toBeVisible();
  await expect(page.getByText("Catálogo de freezers").first()).toBeVisible();
  const pasta = `docs/capturas/movimento-links/${etapa}`;
  await page.screenshot({ path: `${pasta}/${info.project.name}.png`, fullPage: true });
  if (etapa === "depois") {
    await page.getByRole("button", { name: /Ver detalhes de Catálogo de freezers/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `${pasta}/${info.project.name}-detalhe.png` });
  }
});
