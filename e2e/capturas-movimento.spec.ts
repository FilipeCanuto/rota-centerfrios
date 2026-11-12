import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Capturas do movimento para relatório. Só roda com CAPTURA=antes|depois (desktop claro). */
const etapa = process.env.CAPTURA;

test("captura do movimento", async ({ page }, info) => {
  test.skip(
    !etapa || info.project.name !== "desktop-claro",
    "CAPTURA=antes|depois, só desktop-claro",
  );
  await simularBackend(page);
  const pasta = `docs/capturas/movimento-intenso/${etapa}`;
  await page.goto("/links");
  await page.waitForTimeout(110);
  await page.screenshot({ path: `${pasta}/1-entrada-110ms.png` });
  await expect(page.getByText("Catálogo de freezers").first()).toBeVisible();
  await page.screenshot({ path: `${pasta}/1b-entrada-350ms.png` });
  await page.waitForTimeout(1500);
  const card = page.locator(".cartao-interativo").first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${pasta}/2-hover-card.png` });
  const info2 = await card.evaluate((el) => getComputedStyle(el).transform);
  console.log("transform do card em hover:", info2);
  const botao = page.locator("button.pressionar, a.pressionar").first();
  const box = await botao.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    console.log(
      "transform do botao pressionado:",
      await botao.evaluate((el) => getComputedStyle(el).transform),
    );
    await page.screenshot({
      path: `${pasta}/3-pressionado.png`,
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 40),
        width: box.width + 80,
        height: box.height + 80,
      },
    });
    await page.mouse.up();
  }
});
