# Movimento em toda a plataforma (`feat/movimento-global`)

Mesmo sistema da tela de Links (tokens e padrões de `src/styles.css` e `src/design-system/movimento.tsx`), sem biblioteca nova e sem mudar regra de negócio, layout ou hierarquia.

## O que mudou

- **Base:** `linha-interativa` (realce de hover e foco num `::after`, encolhe ao toque), `anel-entrar` e `barra-entrar` (gráficos), `cascata` limitada aos 12 primeiros itens, menus/seletores/popovers/confirmações com a duração e a curva dos tokens, abas (`TabsContent`) com entrada.
- **Modo leve automático:** com até 4 núcleos ou até 2 GB de memória, o `<html>` recebe `data-movimento="leve"`: sem escalonar a cascata, sem escala no hover, transições mais curtas e contador sem contagem.
- **`Contador`:** conta de zero, aceita formatação (moeda) e reserva o espaço do valor final, então não desloca o layout; o leitor de tela recebe só o valor final.
- **Expansão entre telas:** `expansao(id)` / `abrirExpansao(id)` / `DETALHE_EXPANSAO`. O nome de transição fica só no card clicado. Usado em cliente → ficha (lista de Clientes e Orçamentos) e na volta.
- **Telas:** Início (seções em cascata, contadores, anel e barras), Clientes e ficha, Orçamentos (abas com transição, total com contador), Pontos e selos (contador, selos com `pulsar`, ranking com transição), Gestão (cards com hover, totais com contador, barras), Notificações, Agenda, feriados, importação, menu lateral, barra inferior, cabeçalho e busca (toque e realce).

## Fora deste passo

- Orçamento, meta e alerta não têm tela de detalhe; criar uma muda layout e fica para o próximo passo. Hoje eles ganham hover e cascata.
- Toasts (sonner), sheets e modais já tinham entrada e saída; só foram alinhados aos tokens onde faltava.

## Limites

- Só `transform` e `opacity` nas animações novas. `prefers-reduced-motion`: sem deslocamento nem escala, contador direto.
- Entradas não escondem conteúdo do leitor de tela (o conteúdo está no DOM desde o início).

## Verificação

- `tsc` e `eslint` sem erro; `vitest` 106/106; `vite build` ok.
- Playwright + axe (17 rotas, celular e desktop, claro e escuro): 145 passaram na rodada completa; as 7 falhas foram reexecutadas e passaram. Três eram o axe medindo contraste no meio da cascata (o teste agora espera as animações terminarem); quatro eram tempo de carga do servidor de desenvolvimento com 4 processos em paralelo, e passam em série.
- **JS inicial (gzip):** 196,0 kB antes e depois (index 117,7 + client 57,4 + route 21,0); chunk de Orçamentos 2,95 kB.
- **Laboratório, Orçamentos** (servidor de desenvolvimento, CPU 4x mais lenta, 4 rodadas alternadas na mesma condição):

|                      | Antes      | Depois                         |
| -------------------- | ---------- | ------------------------------ |
| LCP                  | 8,7–12,5 s | 8,7–10,5 s                     |
| CLS                  | 0,005      | 0,005–0,008                    |
| Interação mais lenta | 192–272 ms | 224–576 ms (3 de 4 até 256 ms) |

Os valores absolutos são do servidor de desenvolvimento (sem empacotar) e não servem para comparar com as metas de LCP 2,5 s e INP 200 ms; a diferença entre antes e depois está dentro do ruído. Para refazer: `DESEMPENHO=1 bun x playwright test e2e/desempenho.spec.ts`.

- **Não medido:** LCP, INP e CLS no build de produção e em aparelho real.
