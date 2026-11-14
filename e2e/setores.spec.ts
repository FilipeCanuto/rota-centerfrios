import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Fluxos depois do login: 0, 1 e 2+ setores, guarda de rota, lembrar escolha e troca de setor. */
const DOIS = { "rpc/meus_setores": ["comercial", "rh"] };

test("sem setor: tela de sem acesso, com Sair, e o Comercial fica bloqueado", async ({ page }) => {
  await simularBackend(page, { "rpc/meus_setores": [] });
  await page.goto("/setores");
  await expect(page.getByRole("heading", { level: 1, name: "Sem acesso liberado" })).toBeVisible();
  await expect(page.getByText("Fale com o administrador")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/setores/);
});

test("um setor: o login leva direto ao Comercial, sem seletor", async ({ page }) => {
  await simularBackend(page);
  await page.goto("/setores");
  await expect(page).toHaveURL(/\/inicio$/);
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await expect(page.getByRole("menuitem", { name: "Trocar de setor" })).toHaveCount(0);
});

test("dois setores: escolhe pelo teclado, lembra a escolha e troca pelo menu do avatar", async ({
  page,
}) => {
  await simularBackend(page, DOIS);
  await page.goto("/setores");
  await expect(page.getByRole("heading", { level: 1, name: "Escolha o setor" })).toBeVisible();
  const cartoes = page.getByRole("list", { name: "Setores liberados" }).getByRole("button");
  await expect(cartoes).toHaveCount(2);

  const lembrar = page.getByRole("checkbox", { name: /Lembrar minha escolha/ });
  await lembrar.focus();
  await page.keyboard.press("Space");
  await expect(lembrar).toBeChecked();
  await cartoes.filter({ hasText: "Comercial" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/inicio$/);

  // Escolha lembrada: o próximo login vai direto.
  await page.goto("/setores");
  await expect(page).toHaveURL(/\/inicio$/);

  // Trocar de setor ignora a escolha lembrada e mostra o seletor.
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Trocar de setor" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Escolha o setor" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Lembrar minha escolha/ })).not.toBeChecked();
});

test("Configurações no menu do avatar para diretoria, levando a Feriados e Importação", async ({
  page,
}) => {
  await simularBackend(page);
  await page.goto("/inicio");
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Configurações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Feriados/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Importar planilhas/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Usuários e acessos" })).toHaveCount(0);
});

test("Usuários e acessos: pré-cadastro exige pelo menos um setor", async ({ page }) => {
  await simularBackend(page, { user_roles: [{ role: "administrador" }] });
  await page.goto("/configuracoes?aba=usuarios");
  await page.getByRole("button", { name: "Pré-cadastrar" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nome").fill("Ana Teste");
  await dialogo.getByLabel("E-mail da empresa").fill("ana@centerfrios.com");
  await dialogo.getByRole("checkbox", { name: "CENTERFRIOS" }).click();
  await dialogo.getByRole("checkbox", { name: "Comercial" }).click();
  await dialogo.getByRole("button", { name: "Pré-cadastrar" }).click();
  await expect(dialogo.getByRole("alert")).toHaveText("Marque pelo menos um setor.");
});

test("Configurações > Setores (administrador): lista, estado de módulo e criação", async ({
  page,
}) => {
  await simularBackend(page, { user_roles: [{ role: "administrador" }] });
  await page.goto("/configuracoes?aba=setores");
  const lista = page.getByRole("list", { name: "Setores" });
  await expect(lista.getByRole("listitem")).toHaveCount(4);
  await expect(lista.getByText("No ar")).toHaveCount(2);
  await expect(lista.getByText("Módulo em construção")).toHaveCount(2);
  // Sem botão de excluir: setor só se desativa.
  await expect(page.getByRole("button", { name: /Excluir/ })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Ativo: Fiscal" })).not.toBeChecked();

  await page.getByRole("button", { name: "Novo setor" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nome do setor").fill("A");
  await dialogo.getByRole("button", { name: "Criar setor" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("Informe o nome");
});

test("Cadastro de usuário lista setor ativo mesmo sem módulo no ar, mas não o inativo", async ({
  page,
}) => {
  await simularBackend(page, { user_roles: [{ role: "administrador" }] });
  await page.goto("/configuracoes?aba=usuarios");
  await page.getByRole("button", { name: "Pré-cadastrar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("checkbox", { name: "Financeiro" })).toBeVisible();
  await expect(dialogo.getByRole("checkbox", { name: "Fiscal" })).toHaveCount(0);
});
