# Progresso da Fase 1

Fonte única para uma nova sessão continuar de onde parou. Atualizado a cada etapa.

## Situação em 11/11/2026
- Passo 2 (regras de negócio) entregue e juntado ao `main` (PR #1).
- **Aguardando:** você colar no Lovable as mensagens 10 a 15 de `docs/lovable/`, na ordem. Depois, eu confiro as migrações geradas e sigo sem parar.

## Etapas
| # | Etapa | Ramo / PR | Situação |
| --- | --- | --- | --- |
| 1 | Arquitetura (passo 3) | — | A fazer |
| 2 | Polar e acessibilidade (passo 4) | — | A fazer |
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
| 10 | Clientes (códigos Shop9, etiquetas, itens de venda, notas, `ficha_cliente`) | A colar |
| 11 | Importação Shop9 (`importacoes`, `importar_clientes/vendas/orcamentos`) | A colar |
| 12 | Agenda (tipo, hora, tarefas automáticas dos alertas) | A colar |
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

## Pendências abertas
- Remoção das colunas legadas `usuarios.perfil` e `empresas.empresa_id`: precisa da permissão "backward incompatible migrations" no Lovable.
- Login Google com Gmail: teste manual (está em `docs/lancamento.md`).
- Formatação Prettier dos arquivos antigos: passo 7.
