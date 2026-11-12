import { expect, test } from "@playwright/test";
import { simularBackend } from "./simulacao";

/**
 * Medição de laboratório de Orçamentos (LCP, CLS e a interação mais lenta), com CPU 4x mais lenta.
 * Só roda com DESEMPENHO=1, no projeto celular-claro. É servidor de desenvolvimento: vale para
 * comparar antes/depois, não como número de campo.
 */
test("desempenho de Orçamentos", async ({ page }, info) => {
  test.skip(!process.env.DESEMPENHO || info.project.name !== "celular-claro", "DESEMPENHO=1");
  await simularBackend(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const m = { lcp: 0, cls: 0, inp: 0 };
    Object.assign(window, { __m: m });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) m.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.inp = Math.max(m.inp, e.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
  await page.goto("/orcamentos");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamentos" })).toBeVisible();
  await expect(page.getByRole("list").first()).toBeVisible();
  for (const aba of ["Ganhos", "Perdidos", "Abertos"]) {
    await page.getByRole("button", { name: aba, exact: true }).click();
    await page.waitForTimeout(600);
  }
  const m = await page.evaluate(() => (window as unknown as { __m: Record<string, number> }).__m);
  console.log(
    `DESEMPENHO lcp=${Math.round(m.lcp)}ms cls=${m.cls.toFixed(3)} interacao=${Math.round(m.inp)}ms`,
  );
});
