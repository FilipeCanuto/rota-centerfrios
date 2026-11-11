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
| 3 | Login (passo 5, parcial) | `fase1/login` / PR #4 | Concluída |
| 4 | PWA e acabamento (passos 6 e 7) | `fase1/pwa-acabamento` / PR #5 | Concluída |
| 5 | Clientes e ficha 360 | `fase1/clientes` / PR #6 | Concluída |
| 6 | Importação do Shop9 | `fase1/importacao` | Concluída (aguarda PR) |
| 7 | Agenda | `fase1/agenda` | Concluída (aguarda PR) |
| 8 | Orçamentos | `fase1/restante` | Concluída (aguarda PR) |
| 9 | Central de links e arquivos | `fase1/restante` | Concluída (aguarda PR) |
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
| 13 | Links e arquivos (empresa nula, arquivo, bucket `arquivos`) | Aplicada (0016) |
| 14 | Gamificação (pesos, pontos por função, selos, ranking, Instagram) | Aplicada (0017) |
| 15 | Gestão, copiloto, notificações e demonstração completa | Aplicada (0018) |

## Decisões tomadas nesta fase
- **Quem importa as planilhas do Shop9:** só a diretoria. O administrador não vê dados comerciais (decisão C3), então não importa. *Aprovado.*
- **Pesos iniciais da gamificação:** vendas 30, cobertura 20, reativação 20, orçamentos 10, Instagram 5. Seguem a ordem do plano, mas os números são editáveis e estão *aprovados como iniciais*, editáveis pela diretoria.
- **Pontuação por indicador:** ganha o peso quando bate a meta do dia daquele indicador. Reativação e Instagram contam por ocorrência. *Aprovado.*
- **Hashtag da campanha:** começa vazia. A diretoria cadastra; até lá só `@centerfriosoficial` vale.
- **Horário comercial e silêncio das notificações (aprovado):** segunda a sexta das 8h às 18h e sábado das 8h às 12h; silêncio fora disso, aos domingos e feriados, ajustável por pessoa.
- **Selo "Resposta relâmpago":** fica para a Fase 2 (depende do WhatsApp).

## Decisões técnicas
- **Retorno automático sem repetir:** o índice do banco evita duplicar só no mesmo dia. A tela consulta antes e pula o cliente que já tem retorno automático aberto, de qualquer dia. Assim não foi preciso mudar o banco.
- **Agendar leva só o id do cliente no endereço:** o nome é buscado na tela (não fica no histórico do navegador), e o endereço é limpo assim que o formulário abre.
- **Virada do dia com a Agenda aberta:** as tarefas automáticas do novo dia só aparecem ao recarregar a página. Fica assim no piloto.
- **Teste e2e com backend simulado:** login real exigiria digitar credenciais num host que não é local. A sessão e as respostas são simuladas em `e2e/simulacao.ts`; as regras de acesso (RLS) são testadas pelo Lovable no banco.
- **axe com modal aberto:** a regra `aria-hidden-focus` é desligada só enquanto um diálogo do Radix está aberto (ele prende o foco; o fundo não é alcançável).
- **Anel de meta em SVG** no lugar do Recharts: mais leve e sem elementos focáveis escondidos.
- **Ouro com contorno marinho** no anel e na barra quando a meta é atingida: o ouro sozinho não chega a 3:1 sobre fundo claro.
- **Dependências novas (só de desenvolvimento):** `@playwright/test`, `@axe-core/playwright`, `eslint-plugin-jsx-a11y`, pedidas no plano.

- **Mensagens de recusa no primeiro acesso:** dizem se o e-mail é de fora da empresa ou se ainda não foi convidado. Isso revela se um e-mail corporativo está na lista de convites; aceito por ser um sistema interno, com o limite de tentativas do próprio login.
- **Tela de nova senha** só abre com o link de recuperação; uma sessão comum não troca a senha.

- **PWA sem guardar dados no aparelho:** o service worker só mostra a página "sem conexão"; nenhum dado da carteira fica no celular. Não roda na prévia do Lovable.
- **Ícones do app:** continuam os atuais (sem versão maskable) até a marca nova, que espera a escolha do nome.

- **Saúde do cliente:** em risco = sem compra há 90+ dias ou recompra urgente; atenção = recompra em atenção ou esquecido; saudável = o resto. Usa só limites aprovados; valor de compra ainda não entra (o plano não define faixas). *Aprovado pela diretoria em 11/11/2026.*
- **Remanejamento:** supervisor e diretoria; a diretoria tem acesso total (aprovado em 11/11/2026).

- **Importação só de CSV:** o Excel salva como CSV (Arquivo → Salvar como → CSV). Ler .xlsx exigiria uma biblioteca pesada; fica para quando o Shop9 for integrado direto.

- **Importação de vendas:** se uma linha de uma nota tem erro, a nota inteira fica de fora (gravar só parte dos itens deixaria a venda errada). Se um lote de 5.000 falhar, os anteriores já foram gravados; reimportar não duplica.
- **Sem confirmação antes de gravar:** a importação é refeita reimportando o arquivo corrigido; a prévia mostra as primeiras linhas convertidas.

- **Orçamentos:** o vendedor só altera `ultimo_followup`, `proximo_followup` e `observacao` (permissão por coluna); ganho e perdido vêm da importação do Shop9. "Parado" na tela usa o último retorno ou a data do orçamento; o Início também considera o último contato com o cliente, então os números podem divergir por contatos registrados fora do orçamento.

- **Links e arquivos:** diretoria e administrador criam e editam; todos consultam. Arquivo abre e copia por link assinado de 7 dias; "Enviar pelo WhatsApp" abre o WhatsApp sem destinatário, com a mensagem pronta e o link. Apagar link pede confirmação do navegador.

## Pendências abertas
- Ficha 360 sem situação financeira (limite, títulos em aberto): o Shop9 ainda não envia esse dado. Conversas na ficha são só os contatos registrados até o WhatsApp (Fase 2).
- Teclado testado só no Início (link "Pular para o conteúdo"); cada módulo novo ganha o seu teste.
- Cabeçalho ainda calcula o painel inteiro para o sino e o selo de cobertura: troca pelo `cobertura_vendedor` e pelas notificações na etapa 13.
- Remoção das colunas legadas `usuarios.perfil` e `empresas.empresa_id`: precisa da permissão "backward incompatible migrations" no Lovable.
- Login Google com Gmail: teste manual (está em `docs/lancamento.md`).
- Formatação Prettier dos arquivos antigos: passo 7.
