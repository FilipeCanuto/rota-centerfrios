# Progresso da Fase 1

Fonte única para uma nova sessão continuar de onde parou. Atualizado a cada etapa.

## Situação em 11/11/2026
- Passo 2 (regras de negócio) no `main` (PR #1). Etapa 1 no `main` (PR #2).
- Mensagens 10, 11 e 12 aplicadas pelo Lovable (migrações 0013, 0014, 0015) e conferidas; 13 em andamento; 14 e 15 a enviar.

## Como conferir localmente
- `bun install`, depois `bun x vitest run` (regras), `bun x tsc --noEmit`, `bun x eslint .`.
- `bun x playwright test` (axe + teclado em celular/desktop, claro/escuro). Usa o Chrome instalado (`channel: "chrome"`) e um backend simulado em `e2e/simulacao.ts`: nenhuma credencial real nem rede. Em CI sem Chrome, trocar para o Chromium do Playwright.

## Etapas
| # | Etapa | Ramo / PR | Situação |
| --- | --- | --- | --- |
| 1 | Arquitetura (passo 3) | `fase1/arquitetura` / PR #2 | Concluída |
| 2 | Polar e acessibilidade (passo 4) | `fase1/polar-acessibilidade` / PR #3 | Concluída |
| 3 | Login (passo 5, parcial) | — | A fazer |
| 4 | PWA e acabamento (passos 6 e 7) | — | A fazer |
| 5 | Clientes e ficha 360 | — | Depende da mensagem 10 |
| 6 | Importação do Shop9 | — | Depende da mensagem 11 |
| 7 | Agenda | — | Depende da mensagem 12 |
| 8 | Orçamentos | — | Depende da mensagem 10 |
| 9 | Central de links e arquivos | — | Depende da mensagem 13 |
| 10 | Gamificação | — | Depende da mensagem 14 |
| 11 | Copiloto e mascote | — | Depende da mensagem 15 |
| 12 | Gestão | — | Depende da mensagem 15 |
| 13 | Notificações | — | Depende da mensagem 15 |

## Mensagens de banco da Fase 1 (`docs/lovable/`)
| Nº | Assunto | Situação |
| --- | --- | --- |
| 10 | Clientes (códigos Shop9, etiquetas, itens de venda, notas, `ficha_cliente`) | Aplicada (0013) |
| 11 | Importação Shop9 (`importacoes`, `importar_clientes/vendas/orcamentos`) | Aplicada (0014) |
| 12 | Agenda (tipo, hora, tarefas automáticas dos alertas) | Aplicada (0015) |
| 13 | Links e arquivos (empresa nula, arquivo, bucket `arquivos`) | A colar |
| 14 | Gamificação (pesos, pontos por função, selos, ranking, Instagram) | A colar |
| 15 | Gestão, copiloto, notificações e demonstração completa | A colar |

## Decisões tomadas nesta fase
- **Quem importa as planilhas do Shop9:** só a diretoria. O administrador não vê dados comerciais (decisão C3), então não importa. *Aprovado.*
- **Pesos iniciais da gamificação:** vendas 30, cobertura 20, reativação 20, orçamentos 10, Instagram 5. Seguem a ordem do plano, mas os números são editáveis e estão *aprovados como iniciais*, editáveis pela diretoria.
- **Pontuação por indicador:** ganha o peso quando bate a meta do dia daquele indicador. Reativação e Instagram contam por ocorrência. *Aprovado.*
- **Hashtag da campanha:** começa vazia. A diretoria cadastra; até lá só `@centerfriosoficial` vale.
- **Horário comercial e silêncio das notificações (aprovado):** segunda a sexta das 8h às 18h e sábado das 8h às 12h; silêncio fora disso, aos domingos e feriados, ajustável por pessoa.
- **Selo "Resposta relâmpago":** fica para a Fase 2 (depende do WhatsApp).

## Decisões técnicas
- **Teste e2e com backend simulado:** login real exigiria digitar credenciais num host que não é local. A sessão e as respostas são simuladas em `e2e/simulacao.ts`; as regras de acesso (RLS) são testadas pelo Lovable no banco.
- **axe com modal aberto:** a regra `aria-hidden-focus` é desligada só enquanto um diálogo do Radix está aberto (ele prende o foco; o fundo não é alcançável).
- **Anel de meta em SVG** no lugar do Recharts: mais leve e sem elementos focáveis escondidos.
- **Ouro com contorno marinho** no anel e na barra quando a meta é atingida: o ouro sozinho não chega a 3:1 sobre fundo claro.
- **Dependências novas (só de desenvolvimento):** `@playwright/test`, `@axe-core/playwright`, `eslint-plugin-jsx-a11y`, pedidas no plano.

## Pendências abertas
- Teclado testado só no Início (link "Pular para o conteúdo"); cada módulo novo ganha o seu teste.
- Cabeçalho ainda calcula o painel inteiro para o sino e o selo de cobertura: troca pelo `cobertura_vendedor` e pelas notificações na etapa 13.
- Remoção das colunas legadas `usuarios.perfil` e `empresas.empresa_id`: precisa da permissão "backward incompatible migrations" no Lovable.
- Login Google com Gmail: teste manual (está em `docs/lancamento.md`).
- Formatação Prettier dos arquivos antigos: passo 7.
