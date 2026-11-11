# Relatório da Fase 1 — Rota CENTERFRIOS

Atualizado em 11/11/2026, ramo `fase1/restante` (etapas 8 a 13, relatório e CLAUDE.md). As etapas 1 a 7 já estão no `main`.

## O que foi entregue, por módulo
| Módulo | Entrega | Onde |
| --- | --- | --- |
| Arquitetura, design system Polar, acessibilidade | Tokens, componentes, temas claro/escuro/automático, WCAG 2.2 AA | `src/design-system` |
| Login e primeiro acesso | E-mail corporativo, Google, convite, recuperação de senha | `src/routes/auth.tsx` |
| PWA | Instalável; página "sem conexão"; nenhum dado da carteira guardado no aparelho | `public/sw.js` |
| Clientes e ficha 360 | Lista, filtros, etiquetas, notas, compras, itens, remanejamento | `src/modulos/clientes` |
| Importação do Shop9 | CSV de clientes, vendas e orçamentos, só a diretoria | `src/modulos/configuracoes/importacao` |
| Agenda | Dia, semana e lista; tarefas automáticas do plano do dia | `src/modulos/agenda` |
| **Orçamentos** (etapa 8) | Abertos, ganhos e perdidos; selo "Parado" e "Retorno atrasado"; registrar retorno (último, próximo, observação); Agendar | `src/modulos/orcamentos`, `src/regras/orcamentos.ts` |
| **Links e arquivos** (etapa 9) | Lista para a equipe; abrir, copiar link (arquivo com link de 7 dias) e enviar pelo WhatsApp; diretoria e administrador criam, editam, enviam arquivo e apagam | `src/modulos/links` |
| **Gamificação** (etapa 10) | Pontos do mês por indicador, selos, ranking (mês e semana) sem humilhação, posts do Instagram com validação, ajustes de pesos e hashtag pela diretoria | `src/modulos/gamificacao`, `src/regras/gamificacao.ts` |
| **Copiloto e mascote** (etapa 11, mínima) | Mensagem por regras e modelos, apelido e versão do Pinguim à escolha, minimizar, ouvir; Pinguim em SVG com 4 expressões e 4 versões | `src/modulos/copiloto`, `src/design-system/Pinguim.tsx` |
| **Gestão** (etapa 12) | Total da equipe e um cartão por vendedor: meta, esperado até hoje, cobertura, orçamentos parados, sem compra, esquecidos | `src/modulos/gestao`, `src/regras/gestao.ts` |
| **Notificações** (etapa 13, mínima) | Central interna (lista, marcar como lida, marcar todas), contador no sino; alertas do dia viram notificações; cabeçalho leve (`cobertura_vendedor`) | `src/modulos/notificacoes`, `src/modulos/layout` |

## Resultados dos testes (ramo `fase1/restante`)
- **Regras (vitest):** 10 arquivos, 84 testes, todos passando (eram 68 antes do ramo).
- **Tipos (`tsc --noEmit`):** sem erros.
- **Lint (`eslint`):** 0 erros, 14 avisos (todos "fast refresh" de arquivos antigos).
- **Ponta a ponta + axe (Playwright):** 120 de 120 passando, em celular 360 px e desktop, temas claro e escuro. Rodou duas vezes: na primeira, 4 falhas na `/gestao` (selo dentro de lista de definição); corrigido e repetida a bateria inteira. As telas novas (`/orcamentos`, `/links`, `/gamificacao`, `/gestao`, `/notificacoes`) estão na lista do axe, com reflow a 320 px nos celulares.
- **Revisões independentes (subagente):** gamificação (10 achados, corrigidos os relevantes), gestão (5 achados, corrigidos 3; os outros 2 documentados) e revisão final do ramo (5 achados, 4 corrigidos; um documentado).
- **Não rodado:** testes de banco (`tests/*.py`) — dependem de credenciais do Lovable e não mudaram nesta fase.

## Pendências
- **Notificações:** tela de preferências (tipos desligados, horário de expediente por pessoa) e silêncio fora do expediente, aos domingos e feriados. A tabela já existe; falta a tela e a regra de exibição.
- **Pinguim:** só estático; refinamento visual e animações ficam para a revisão geral.
- **Gamificação:** pontos de dias passados só se atualizam quando a tela é aberta naquele dia; após aprovar/recusar post o foco volta ao início da página.
- **Expressão do Pinguim:** usa 100% e 70% da meta como cortes fixos (efeito só visual, não é regra de negócio); se a diretoria quiser editar, vira configuração.
- **Orçamentos:** a tela mostra os 200 mais recentes por situação; "parado" considera o último retorno ou a data do orçamento (o Início também considera o último contato com o cliente).
- **Gestão:** papel de supervisor/diretoria é lido de forma global (a RLS limita os dados por empresa); sem faixa "no ritmo/atrasado" além da comparação com o esperado até hoje.
- **Links:** a coluna `url` aceita qualquer texto no banco; o app só abre http(s), mas vale um CHECK no banco (pedir ao Lovable).
- Ficha 360 sem situação financeira; remoção das colunas legadas `usuarios.perfil` e `empresas.empresa_id`; login Google com Gmail (teste manual); formatação Prettier dos arquivos antigos.

## Checklist de lançamento
O checklist completo está em [lancamento.md](lancamento.md). Acrescentar, para esta etapa:
- [ ] Orçamentos: importar orçamentos do Shop9 e conferir que "Parado" bate com o Início para um vendedor.
- [ ] Links: administrador cadastra um link para as duas empresas e um PDF; vendedor copia o link do PDF e abre pelo celular; link inativo não aparece para o vendedor.
- [ ] Gamificação: diretoria cadastra a hashtag da campanha e confere os pesos; vendedor envia um post; supervisor da equipe aprova; os 5 pontos aparecem.
- [ ] Gestão: supervisor vê só a equipe; diretoria vê as duas empresas.
- [ ] Notificações: abrir o Início cria os avisos do dia; marcar como lida diminui o contador.

## O que conferir à mão
1. **No celular real (Clara e Humberto):** instalar o app, abrir Orçamentos, Links (enviar pelo WhatsApp abre o aplicativo com a mensagem e o link), Pontos e selos e o sino.
2. **Link assinado do PDF:** abre no celular e expira em 7 dias.
3. **Pinguim:** as 4 expressões e as 4 versões em tamanho pequeno (cabem e se distinguem?). O desenho é provisório.
4. **Pontuação:** com dados reais, conferir um dia fechado de um vendedor contra a conta manual (meta do dia de vendas, orçamentos e cobertura).
5. **Copiloto "Ouvir":** depende da voz do aparelho; em alguns celulares não há voz em português.
6. **Texto das mensagens:** ler as frases do copiloto e as mensagens prontas de links com a diretoria.
