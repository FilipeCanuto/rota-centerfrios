import { expect, test, type Page } from "@playwright/test";
import { simularBackend } from "./simulacao";

/** Capturas do login e das Configurações para o relatório. Só roda com CAPTURA=1. */
test.skip(!process.env.CAPTURA, "defina CAPTURA=1");

const PASTA = "docs/capturas/login-configuracoes";
const arte = (cor: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="#0b1f44"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="1150" cy="380" r="260" fill="#ffffff22"/></svg>`;
const linha = (id: string, ordem: number, texto: string) => ({
  id,
  arquivo_path: `${id}.svg`,
  tipo: "imagem",
  texto_alternativo: texto,
  ordem,
  ativo: true,
  criado_por: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
});
const MIDIAS = [linha("m1", 0, "Loja CENTERFRIOS"), linha("m2", 1, "Equipe em Maceió")];

async function simularStorage(page: Page) {
  await page.route(/\/storage\/v1\/object\/sign\/midia-login\//, (r) => {
    if (r.request().method() === "POST") {
      const caminho = new URL(r.request().url()).pathname.split("/midia-login/")[1];
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedURL: `/object/sign/midia-login/${caminho}?token=t` }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: arte(r.request().url().includes("m2") ? "#c9a227" : "#1b4fa0"),
    });
  });
}

async function login(page: Page, midias: unknown[]) {
  await page.route(/supabase\.co\/auth\/v1\//, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route(/supabase\.co\/rest\/v1\/midia_login/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(midias) }),
  );
  await simularStorage(page);
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar na Rota" })).toBeVisible();
  const palco = page.getByTestId("palco-login");
  if (midias.length)
    await expect(palco.getByRole("img", { name: "Loja CENTERFRIOS" })).toBeVisible({
      timeout: 60_000,
    });
  else
    await expect(palco.getByRole("img", { name: "CENTERFRIOS" })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("captura do login com mídia, sem mídia e (no desktop) em tablet", async ({ page }, info) => {
  const nome = info.project.name;
  await login(page, MIDIAS);
  await page.screenshot({ path: `${PASTA}/${nome}-login.png` });
  if (nome.startsWith("desktop")) {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${PASTA}/${nome}-login-tablet.png` });
  }
});

test("captura do login sem mídia (fundo da marca)", async ({ page }, info) => {
  await login(page, []);
  await page.screenshot({ path: `${PASTA}/${info.project.name}-login-marca.png` });
});

test("captura de Configurações, aba Mídia do login", async ({ page }, info) => {
  await simularBackend(page, { user_roles: [{ role: "administrador" }], midia_login: MIDIAS });
  await simularStorage(page);
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("list", { name: /Mídias do login/ })).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `${PASTA}/${info.project.name}-configuracoes.png`,
    fullPage: true,
  });
});
