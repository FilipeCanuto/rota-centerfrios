import { expect, test } from "@playwright/test";

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
