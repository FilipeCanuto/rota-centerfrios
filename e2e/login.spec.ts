import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

test("mostrar senha alterna o tipo do campo e informa o estado", async ({ page }) => {
  await page.goto("/auth");
  const senha = page.getByLabel("Senha", { exact: true });
  await expect(senha).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(senha).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("esqueci minha senha envia o link e mostra o aviso", async ({ page }) => {
  await page.route(/supabase\.co\/auth\/v1\/recover/, (r) =>
    r.fulfill({ status: 200, body: "{}" }),
  );
  await page.goto("/auth");
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Esqueci minha senha" })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
  await page.getByLabel("E-mail").fill("vendedor@centerfrios.com");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "enviamos um link" })).toBeVisible();
});

test("primeiro acesso recusado mostra a explicação do convite", async ({ page }) => {
  await page.route(/supabase\.co\/auth\/v1\/signup/, (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "P0001",
        message: "Seu acesso ainda não foi liberado. Peça o convite ao administrador.",
      }),
    }),
  );
  await page.goto("/auth");
  await page.getByRole("button", { name: /criar minha senha/i }).click();
  await page.getByLabel("Nome").fill("Teste");
  await page.getByLabel("E-mail").fill("novo@centerfrios.com");
  await page.getByLabel("Crie sua senha").fill("senha-segura-1");
  await page.getByRole("button", { name: "Criar minha senha" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Peça o convite" })).toBeVisible();
});

test("nova senha sem link de recuperação mostra que o link expirou", async ({ page }) => {
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("alert").filter({ hasText: "expirou" })).toBeVisible();
  await expect(page.getByLabel("Nova senha")).toHaveCount(0);
});

test("trocar de modo leva o foco para o novo título", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Esqueci minha senha" })).toBeFocused();
});

const rotaToken = /supabase\.co\/auth\/v1\/token/;

test("senha errada e e-mail não confirmado têm mensagens diferentes", async ({ page }) => {
  await page.route(rotaToken, (r) =>
    r.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "invalid_credentials", message: "Invalid login credentials" }),
    }),
  );
  await page.goto("/auth");
  await page.getByLabel("E-mail").fill("vendedor@centerfrios.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Esqueci minha senha" })).toBeVisible();
  await page.unroute(rotaToken);
  await page.route(rotaToken, (r) =>
    r.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "email_not_confirmed", message: "Email not confirmed" }),
    }),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "não foi confirmado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reenviar e-mail de confirmação" })).toBeVisible();
});

test("primeiro acesso com e-mail que já tem conta orienta a criar senha pelo link", async ({
  page,
}) => {
  await page.route(/supabase\.co\/auth\/v1\/signup/, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "x", email: "a@centerfrios.com", identities: [] }),
    }),
  );
  await page.goto("/auth");
  await page.getByRole("button", { name: /criar minha senha/i }).click();
  await page.getByLabel("Nome").fill("Teste");
  await page.getByLabel("E-mail").fill("a@centerfrios.com");
  await page.getByLabel("Crie sua senha").fill("senha-segura-1");
  await page.getByRole("button", { name: "Criar minha senha" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "já tem cadastro" })).toBeVisible();
});

test("link de recuperação que cai em outra página vai para a tela de nova senha", async ({
  page,
}) => {
  await page.goto("/#access_token=abc&refresh_token=def&type=recovery");
  await expect(page).toHaveURL(/\/redefinir-senha/);
  await expect(page.getByRole("heading", { level: 1, name: "Crie uma nova senha" })).toBeVisible();
});

test("Voltar: não aparece no Início; em /configuracoes/feriados sem histórico leva a Mais", async ({
  page,
}) => {
  await simularBackend(page);
  await page.goto("/inicio");
  await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(0);
  await page.goto("/configuracoes/feriados");
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/mais$/);
  await page.getByRole("link", { name: "Orçamentos" }).click();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/mais$/);
});
