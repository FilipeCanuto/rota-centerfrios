import { expect, test, type Page } from "@playwright/test";
import { simularBackend } from "./simulacao";

const json = (status: number, corpo: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(corpo),
});
const rotaToken = /supabase\.co\/auth\/v1\/token/;
const rotaOtp = /supabase\.co\/auth\/v1\/otp/;

async function pedirLink(page: Page, email: string) {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Primeiro acesso ou esqueci a senha" }).click();
  await page.getByLabel("E-mail da empresa").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
}

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

test("campos vazios e e-mail de fora da empresa são avisados antes de enviar", async ({ page }) => {
  let chamou = false;
  await page.route(rotaToken, (r) => {
    chamou = true;
    return r.fulfill(json(400, {}));
  });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Digite o seu e-mail da empresa.");
  await expect(page.getByLabel("E-mail da empresa")).toBeFocused();
  await page.getByLabel("E-mail da empresa").fill("clara@gmail.com");
  await page.getByLabel("Senha", { exact: true }).fill("x");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("@centerfrios.com ou @grupo381.com.br");
  expect(chamou).toBe(false);
});

test("link de acesso: envia e mostra o aviso com o e-mail normalizado", async ({ page }) => {
  let corpo = "";
  await page.route(rotaOtp, (r) => {
    corpo = r.request().postData() ?? "";
    return r.fulfill(json(200, {}));
  });
  await pedirLink(page, "  Clara@CenterFrios.com ");
  await expect(page.getByRole("status").filter({ hasText: "Enviamos um link" })).toContainText(
    "clara@centerfrios.com",
  );
  expect(corpo).toContain('"email":"clara@centerfrios.com"');
  expect(corpo).toContain('"create_user":true');
});

test("link de acesso para quem não foi convidado explica o convite", async ({ page }) => {
  await page.route(rotaOtp, (r) =>
    r.fulfill(json(500, { code: "unexpected_failure", message: "Database error saving new user" })),
  );
  await pedirLink(page, "novo@centerfrios.com");
  await expect(page.getByRole("alert")).toContainText("ainda não foi liberado");
});

test("trocar de modo leva o foco para o novo título", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Primeiro acesso ou esqueci a senha" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Receber link de acesso" }),
  ).toBeFocused();
});

test("senha errada e e-mail não confirmado têm mensagens diferentes", async ({ page }) => {
  await page.route(rotaToken, (r) =>
    r.fulfill(json(400, { code: "invalid_credentials", message: "Invalid login credentials" })),
  );
  await page.goto("/auth");
  await page.getByLabel("E-mail da empresa").fill("vendedor@centerfrios.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha incorretos");
  await page.unroute(rotaToken);
  await page.route(rotaToken, (r) =>
    r.fulfill(json(400, { code: "email_not_confirmed", message: "Email not confirmed" })),
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("não foi confirmado");
});

test("login certo mostra o check e o Bem-vindo antes do Início", async ({ page }) => {
  await page.route(/supabase\.co\/rest\/v1\//, (r) => r.fulfill(json(200, { nome: "Clara Lima" })));
  await page.route(rotaToken, (r) =>
    r.fulfill(
      json(200, {
        access_token: "a",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "r",
        user: {
          id: "u1",
          email: "clara@centerfrios.com",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      }),
    ),
  );
  await page.goto("/auth");
  await page.getByLabel("E-mail da empresa").fill("clara@centerfrios.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-certa");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Login confirmado" })).toBeAttached();
  await expect(page.getByText("Bem-vindo, Clara!")).toBeVisible();
});

test("tela Crie sua senha sem link mostra que o link expirou", async ({ page }) => {
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("alert").filter({ hasText: "expirou" })).toBeVisible();
  await expect(page.getByLabel("Nova senha")).toHaveCount(0);
});

test("link do e-mail que cai em outra página vai para Crie sua senha", async ({ page }) => {
  await page.goto("/#access_token=abc&refresh_token=def&type=magiclink");
  await expect(page).toHaveURL(/\/redefinir-senha/);
  await expect(page.getByRole("heading", { level: 1, name: "Crie sua senha" })).toBeVisible();
});

test("link vencido que cai na página inicial mostra o aviso no login", async ({ page }) => {
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=expired");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("alert")).toContainText("expirou");
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
