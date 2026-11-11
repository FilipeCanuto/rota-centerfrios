import { expect, test } from "@playwright/test";
import { EMPRESA_CF, simularBackend } from "./simulacao";

const CSV =
  "Código;Razão Social;Celular;E-mail Vendedor\r\n10;Padaria A;(82) 99999-0000;clara@centerfrios.com\r\n11;;;clara@centerfrios.com\r\n";

test("importa clientes: prévia com erro por linha e resultado do banco", async ({ page }) => {
  await simularBackend(page, {
    "rpc/importar_clientes": {
      importacao_id: "imp1",
      inseridas: 1,
      atualizadas: 0,
      ignoradas: 0,
      erros: [],
    },
    importacoes: [],
  });
  await page.goto("/configuracoes/importacao");
  await page.getByRole("main").getByLabel("Empresa", { exact: true }).click();
  await page.getByRole("option", { name: "CENTERFRIOS" }).click();
  await page.getByLabel("Arquivo CSV exportado do Shop9").setInputFiles({
    name: "clientes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf-8"),
  });
  await expect(page.getByText("1 linhas prontas para gravar; 1 com erro")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nome vazio." })).toBeVisible();
  await page.getByRole("button", { name: "Gravar 1 no sistema" }).click();
  await expect(page.getByText(/1 novos, 0 atualizados/)).toBeVisible();
  expect(EMPRESA_CF).toBeTruthy();
});

test("recusa arquivo que não é CSV", async ({ page }) => {
  await simularBackend(page, { importacoes: [] });
  await page.goto("/configuracoes/importacao");
  await page
    .getByLabel("Arquivo CSV exportado do Shop9")
    .setInputFiles({
      name: "x.xlsx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("x"),
    });
  await expect(page.getByRole("alert").filter({ hasText: "Use um arquivo .csv" })).toBeVisible();
});
