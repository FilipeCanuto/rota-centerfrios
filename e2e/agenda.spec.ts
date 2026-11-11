import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

test("agenda do dia mostra a tarefa de hoje e a atrasada", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/agenda");
  await expect(page.getByText("Ligar para fechar o pedido")).toBeVisible();
  await page.getByRole("button", { name: "Dia", exact: true }).click();
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

test("calendário do mês: setas mudam o dia, legenda e retorno do orçamento no dia anterior", async ({
  page,
}) => {
  await simularBackend(page);
  await page.goto("/agenda");
  await expect(page.getByRole("list", { name: "Legenda do calendário" })).toBeVisible();
  const hoje = page.locator('button[aria-current="date"]');
  await hoje.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[role="gridcell"][aria-selected="true"] button')).toBeFocused();
  await expect(page.getByText("Retorno do orçamento: Cliente Teste 1")).toBeVisible();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.locator('[role="gridcell"][aria-selected="true"] button')).toHaveAttribute(
    "aria-current",
    "date",
  );
  await page.getByRole("button", { name: "Agendar neste dia" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
