import { expect, test } from "@playwright/test";
import { CLIENTE_ID, simularBackend } from "./simulacao";

test("lista de clientes abre a ficha 360 com todas as seções", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { level: 2, name: /clientes/ })).toBeVisible();
  await page.getByRole("link", { name: /Cliente Teste 1/ }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${CLIENTE_ID}`));
  for (const secao of [
    "Etiquetas",
    "Notas",
    "Itens mais comprados (12 meses)",
    "Orçamentos (1)",
    "Últimas compras",
    "Contatos recentes",
    "Mudar de carteira",
  ])
    await expect(page.getByRole("heading", { level: 2, name: secao })).toBeVisible();
  await expect(page.getByText("Prefere entrega pela manhã.")).toBeVisible();
});

test("remanejar pede vendedor e motivo antes de chamar o banco", async ({ page }) => {
  await simularBackend(page);
  await page.goto(`/clientes/${CLIENTE_ID}`);
  await page.getByRole("button", { name: "Mudar de carteira" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Escolha o vendedor" })).toBeVisible();
});
