import { defineConfig } from "@playwright/test";

/** Ponta a ponta com axe: celular (360 px) e desktop, temas claro e escuro. Usa o Chrome instalado. */
const tamanhos = { celular: { width: 360, height: 780 }, desktop: { width: 1280, height: 800 } };
const temas = ["light", "dark"] as const;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", channel: "chrome" },
  projects: Object.entries(tamanhos).flatMap(([nome, viewport]) =>
    temas.map((tema) => ({
      name: `${nome}-${tema === "light" ? "claro" : "escuro"}`,
      use: { viewport, colorScheme: tema },
    })),
  ),
  webServer: {
    command: "npx -y bun@1.3.4 x vite dev --port 5173 --strictPort",
    url: "http://localhost:5173/auth",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
