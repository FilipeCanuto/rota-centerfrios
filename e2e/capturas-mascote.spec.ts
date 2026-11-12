import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Capturas do mascote para relatório. Só roda com CAPTURA_MASCOTE=1. */
test("captura do mascote: estados, tamanhos e flutuante", async ({ page }, info) => {
  test.skip(!process.env.CAPTURA_MASCOTE, "defina CAPTURA_MASCOTE=1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await simularBackend(page);
  const pasta = "docs/capturas/mascote";
  await page.goto("/design-system");
  // A vitrine mostra os dois temas na mesma página: a primeira é a clara, a última a escura.
  const vitrines = page.getByTestId("mascote-vitrine");
  const vitrine = info.project.name.endsWith("escuro") ? vitrines.last() : vitrines.first();
  await expect(vitrine).toBeVisible();
  await vitrine.screenshot({ path: `${pasta}/vitrine-${info.project.name}.png` });
  await page.goto("/inicio");
  await expect(page.getByRole("button", { name: /Menu do mascote/ })).toBeVisible();
  await page.screenshot({ path: `${pasta}/flutuante-${info.project.name}.png` });
});
