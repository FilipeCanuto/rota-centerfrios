# Relatório: Início e barra "Meta do mês"

Branch `feat/inicio-meta`. Sem mudança de banco. Este relatório substitui, nesta etapa, a atualização de `docs/progresso.md` (outra sessão está editando esse arquivo).

## O que mudou
- **Regra nova** `src/regras/ritmo.ts` (`calcularRitmo`): ritmo de hoje = dias úteis decorridos ÷ dias úteis do mês, projeção linear por dias úteis, valor que falta, ritmo necessário por dia útil restante e status (`abaixo` / `no_ritmo` / `batida`). Os feriados vêm da tabela e o dia é calculado no fuso de Maceió (`hojeEmMaceio`). O painel expõe o resultado em `p.ritmo`.
- **Componente** `src/design-system/BarraMeta.tsx`, reutilizável: recebe `faturado`, `meta` e `ritmo`, então serve para o vendedor, a equipe do supervisor e a diretoria com os dados das funções que já existem.
  - Escala de 0 a 125% da meta, marca "Meta · R$ X mil" em 100% e marcas de 25, 50 e 75% embaixo.
  - O preenchimento usa `scaleX` com a curva `cubic-bezier(.22,1,.36,1)` em 1,4 s, e os números usam o contador animado. A barra entra do zero só ao montar; quando os dados mudam, anima do valor anterior ao novo.
  - Projeção em listras deslizando (7 s), brilho que "respira" na ponta da barra (3,8 s) e reflexo a cada 9 s. Tudo usa só transform e opacity.
  - As animações contínuas pausam com a aba oculta ou com o cartão fora da tela (`useViva`, IntersectionObserver) e ficam todas desligadas com `prefers-reduced-motion`.
  - Selo com ícone e palavra. Com a meta batida, o preenchimento e o % ficam em ouro, com uma pequena celebração. Token novo `--ouro-texto`: âmbar 700 no tema claro (para contraste AA) e ouro 400 no escuro.
  - Três indicadores: falta para a meta (ou "Acima da meta"), ritmo necessário por dia útil com os dias úteis restantes (ou "Concluído") e projeção do mês (ou "Fechamento do mês"). No celular eles ficam empilhados.
  - Legenda, `role="img"` com descrição completa e botão "Ver tabela"/"Ocultar tabela" com `aria-expanded`/`aria-controls`. A tabela tem caption e `th scope="row"`, entra com fade e deslize de 360 ms e rola na horizontal dentro do próprio recipiente.
- **Início** (`PainelInicio.tsx`) na nova ordem: O que fazer agora (plano do dia e alertas urgentes, em largura total) → Meta do mês → Metas do dia → Cobertura → Outros alertas. O cartão antigo do Pinguim saiu; o mascote flutuante continua falando em balão e registrando no sino. Os estados vazios viraram chamada para ação (Abrir a agenda, Ver carteira, Ver orçamentos).
- **"Personalizar o copiloto"** foi para o menu do usuário, no cabeçalho (`PersonalizarCopiloto`).
- **Correções**
  - Se a imagem do logo falhar, aparece o nome em texto, sem empurrar o cabeçalho.
  - A data aparece só com a primeira letra maiúscula ("Segunda-feira, 16 de novembro").
  - O botão "Ouvir" está oculto (`VOZ_LIGADA = false`); o código foi mantido.
- **Gestão** (supervisor e diretoria, `TelaGestao.tsx`): a `BarraMeta` substitui a barra simples no total da equipe e no cartão de cada vendedor, com os feriados da empresa. A prop `rotulo` diferencia cada barra para o leitor de tela (ex.: "Meta do mês de Ana").
- A tabela da barra, quando rola na horizontal, agora recebe foco pelo teclado (região com nome). O axe apontou isso nos cartões estreitos da Gestão no celular.

## Verificações
- `tsc` e `eslint` sem erros nos arquivos alterados (os 8 avisos de fast refresh já existiam).
- `vitest`: 139 testes passando, incluindo `ritmo.test.ts` (6 testes, com feriados).
- e2e `e2e/inicio-meta.spec.ts`: Gestão com a barra da equipe e a de cada vendedor (tabela, axe e sem rolagem lateral); no Início, hierarquia, barra, tabela, axe e ausência de rolagem lateral, em celular e desktop, nos temas claro e escuro. O `/inicio` do `acessibilidade.spec.ts` também passa. Um teste falhou uma vez porque a página veio em branco enquanto o servidor de desenvolvimento ainda compilava; rodado de novo, passou.
- `vite build` ok.

## Capturas
Em `docs/capturas/inicio-meta/` (antes e depois, no celular claro e no desktop escuro). O "depois" foi tirado antes de dois ajustes finos, feitos sem uma terceira rodada de capturas: a linha tracejada do ritmo deixou de cruzar o rótulo "50%" e o nome do logo em texto ficou menor no celular.

## Pendente / riscos
- Os itens repetidos no plano da simulação vêm da visão "Ambas as empresas" do backend simulado e já existiam antes desta mudança.
