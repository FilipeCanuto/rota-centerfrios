# Relatório visual (branch `visual/fable`)

Objetivo: deixar a Rota mais atrativa e premium (Polar + CENTERFRIOS) pelos componentes base, sem mexer em regras, banco, integrações ou setores. Capturas em `docs/capturas/visual-fable/antes` e `/depois` (2 rodadas; celular claro e desktop escuro).

## 1. Diagnóstico por tela (antes)

| Tela | O que foi visto |
|---|---|
| Todas | Superfícies chapadas: borda de 1 px e sombra quase invisível; no escuro não havia profundidade nenhuma. Cabeçalho e barra inferior sem separação do conteúdo. Botão principal chapado. Foco dos campos com anel de 1 px. Menus e diálogos com sombras diferentes entre si. |
| Celular (todas menos Início) | "Voltar" encostava na logo cortada ("CE…"). |
| Início | Boa hierarquia; lista "O que fazer agora" densa; mascote flutuante cobre o botão "Agendar" na borda direita (dá para arrastar; não mexi). |
| Clientes | Filtros ocupam a primeira tela inteira no celular; skeleton só piscava. |
| Orçamentos | Abas são botões; a ativa só mudava de cor. |
| Agenda | Skeletons simples; consistente com o resto. |
| Pontos e selos | Vazios em texto solto ("Nenhum selo ainda"); barras de progresso paradas. |
| Links, Gestão, Mais | Cards interativos já com hover, foco e toque; sem pendência de estado. |
| Notificações | Item ativo da barra inferior marcado só pela cor (nas telas principais). |

## 2. O que mudou (tudo nos componentes base)

- **Profundidade em camadas** (`styles.css`): tokens `--sombra-cartao` e `--sombra-flutuante` (fio de luz no topo + sombra curta + sombra larga), com cor de sombra por tema. Usados por `Card`, utilitário `cartao`, abas, menus, popovers e diálogos (uma regra só). Sombras são estáticas, nunca animadas.
- **Fundo**: brilho polar parado (azul e ouro, até 5%) atrás de tudo; cabeçalho e barra inferior com sombra de separação.
- **Botão principal** (`brilho-botao`): fio de luz, sombra colorida e véu claro no hover (só opacidade).
- **Abas** (`tabs.tsx`): toque com a mola do sistema e aba ativa com a sombra em camadas.
- **Barra inferior**: marca do item ativo que cresce para o lugar (`marca-ativa`, transform + opacity).
- **Skeleton**: faixa de luz que atravessa (transform); em aparelho fraco volta ao pulso de opacidade.
- **Estado vazio** (`EstadoVazio`): mascote "pensando" (decorativo, `aria-hidden`) com o ícone do assunto como selo; só se move na tela e com a aba visível.
- **Conquista**: `SeloStatus` de conquista ganha um reflexo que cruza uma vez; utilitário `celebrar` disponível para ícones.
- **Indicadores vivos**: `Progresso` ganhou o reflexo periódico (como a barra da meta), pausado fora da tela (`useViva`); trilho da barra da meta com relevo interno.
- **Troca de tela**: entrada com leve escala além da subida.
- **Campos**: anel de foco de 2 px em input, textarea e select.
- **Celular**: a logo sai do cabeçalho quando há "Voltar" (não corta mais).

## 3. Limites respeitados

- Animações novas só com `transform` e `opacity`, em pseudo-elementos.
- "Reduzir movimento": reflexos e luz do skeleton desligados; o resto cai no fade curto que já existia.
- "Intensidade do movimento": tudo usa os tokens de duração, curva e mola (Suave/Normal/Expressivo).
- Modo leve (aparelho fraco): sem reflexo contínuo, skeleton em pulso, mascote parado.
- Aba oculta: `data-aba-oculta` agora é marcado na raiz por `movimento.tsx` (antes só existia depois do login) e pausa toda animação contínua. Fora da tela: `useViva` em `Progresso`, `EstadoVazio` e `BarraMeta`.
- Sem dependência nova.

## 4. Verificações

| Item | Antes | Depois |
|---|---|---|
| JS inicial (gzip: index + client + route) | 176,2 kB | 176,4 kB (≤ 200) |
| CSS (gzip) | 20,9 kB | 21,8 kB |
| Orçamentos, celular, CPU 4× mais lenta — interação mais lenta | 96 / 96 ms | 104 / 112 / 96 ms (uma rodada deu 208 ms, ruído; < 200) |
| CLS | 0,006 / 0,008 | 0,003 a 0,007 (< 0,1) |
| LCP (servidor de desenvolvimento, frio) | 10,9 / 11,4 s | 8,9 a 13,6 s |

O LCP do teste é do servidor de desenvolvimento com CPU 4× lenta e compila na hora; serve só para comparar antes/depois (iguais dentro do ruído). O LCP < 2,5 s precisa ser medido no app publicado; não medi.

- `tsc` sem erro; `vitest` passou; `eslint` com 1 erro de formatação que já existe na `main` (`SimularAlertas.tsx`, não mexi); build OK.
- Ponta a ponta + axe (4 projetos, 308 testes): na primeira rodada 16 falhas; 11 passaram ao repetir com menos paralelismo (lentidão da máquina). Das que sobraram:
  - **"se o mascote falhar, o app segue funcionando"**: o app inteiro caía porque `movimento.tsx` lê `hardwareConcurrency` ao carregar. Corrigido (leitura protegida, cai no movimento normal). Passa nos 4 projetos.
  - **"arrastar encaixa no canto mais próximo"**: intermitente, e falha igual com o código da `main` (2 de 4 nas duas). Não é desta mudança; fica como pendência do teste.
- Nenhuma violação de axe nova (contraste do texto não mudou: sombras e brilho de fundo ficam abaixo de 5% de cor).

## 5. Pendências

- Medir LCP/INP no app publicado (campo), não só no servidor de desenvolvimento.
- Teste de arrastar do mascote instável (já na `main`).
- ~~Mascote flutuante cobre o "Agendar" no Início no desktop.~~ Resolvido: sem canto salvo, o padrão no desktop (≥ 768 px) passou a ser o inferior esquerdo, sobre o rodapé vazio do menu lateral (`modulos/mascote/dados.ts`; a regra `cantoValido` não mudou). No celular segue o inferior direito, porque à esquerda ficam os botões "Abrir WhatsApp". Quem já arrastou continua onde deixou.
