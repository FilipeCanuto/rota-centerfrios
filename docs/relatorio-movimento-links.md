# Movimento do Polar e tela Links e arquivos (`feat/movimento-links`)

## O que mudou
- **Tokens de movimento** (`src/styles.css`): `--duracao-rapida|media|lenta` (120/200/360 ms), `--ease-polar`, `--curva-saida`, `--curva-enfase`, `--mola`, `--distancia-curta|media`, `--escala-hover`, `--escala-pressionar`, `--passo-cascata`.
- **Padrões** (utilitários): `pressionar` (toque), `cartao-interativo` (hover/foco/toque em card clicável), `cascata` (entrada de lista), `esqueleto`, e as transições de visão (troca de tela, filtro, card → detalhe). Em código: `transicaoDeVisao()` e `Contador` em `src/design-system/movimento.tsx`.
- **Componentes base**: `Button` (pressionar), `Card` (`interativo`), `Dialog` e `Sheet` (durações e curva dos tokens), `Skeleton`, roteador (`defaultViewTransition`).
- **Links e arquivos**: cabeçalho de seção com ícone e contagem, cards em grade (1/2/3 colunas), ícone do tipo, título forte, empresa, selo Cliente/Interno; Abrir (e WhatsApp nos de cliente) visíveis, Copiar e Editar em ícones com rótulo; clicar no card abre o detalhe com expansão; filtro com transição.

## Decisões
- **Sem biblioteca de animação.** Tudo em CSS e na View Transitions API do navegador: nenhum JS novo no carregamento. Onde a API não existe, a mudança acontece sem a expansão (o modal ainda tem o seu fade).
- Só `transform` e `opacity` animam (a sombra do hover fica num `::after` e só a opacidade muda).
- `prefers-reduced-motion`: sem escala nem deslocamento; transições viram troca imediata.
- Nada depende de hover: todas as ações estão visíveis no card e no detalhe.

## Verificação
- `tsc` e `eslint` sem erro; `vitest` 106/106.
- Playwright + axe (celular e desktop, claro e escuro): `/links`, detalhe aberto, teclado (Enter abre, Esc fecha e o foco volta ao card), filtro; componentes abertos do Início. Tudo passou.
- Build: JS inicial ≈ 196 kB gzip (index 117,7 + client 57,4 + route 20,9), igual ao de antes, pois não entrou dependência; chunk de links 7,7 kB.
- **Não medido:** INP e CLS em aparelho real (não há medição de campo no projeto). O risco é baixo porque nada anima layout, mas falta o número.

## Capturas
Em `docs/capturas/movimento-links/antes` e `depois` (celular e desktop, claro e escuro, e o detalhe). Para refazer: `CAPTURA=depois bun x playwright test e2e/capturas-links.spec.ts`.
