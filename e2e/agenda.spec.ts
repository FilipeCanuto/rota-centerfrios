import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

test("agenda do dia mostra a tarefa de hoje e a atrasada", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/agenda");
  await expect(page.getByText("Ligar para fechar o pedido")).toBeVisible();
  await expect(page.getByText("Enviar catálogo atrasado")).toBeVisible();
  await expect(page.getByText("Atrasada")).toBeVisible();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByText("Ligar para fechar o pedido")).toBeVisible();
});

test("Agendar no plano do dia abre a nova tarefa com o cliente", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/inicio");
  await page
    .getByRole("link", { name: /Agendar Cliente Teste 1/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Cliente: Cliente Teste 1")).toBeVisible();
  await expect(page).not.toHaveURL(/cliente=/);
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
