import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Capturas do relatório visual. Só roda com CAPTURA_VISUAL=antes|depois (celular claro e desktop escuro). */
const etapa = process.env.CAPTURA_VISUAL;
const TELAS = [
  "inicio",
  "clientes",
  "orcamentos",
  "agenda",
  "gamificacao",
  "links",
  "gestao",
  "notificacoes",
  "mais",
];

test("capturas do visual", async ({ page }, info) => {
  test.skip(
    !etapa || !["celular-claro", "desktop-escuro"].includes(info.project.name),
    "CAPTURA_VISUAL=antes|depois",
  );
  await simularBackend(page);
  for (const tela of TELAS) {
    await page.goto(`/${tela}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: `docs/capturas/visual-fable/${etapa}/${tela}-${info.project.name}.png`,
    });
  }
});
