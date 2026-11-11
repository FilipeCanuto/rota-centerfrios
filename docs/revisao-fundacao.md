# Revisão da fundação — Rota CENTERFRIOS

Data: 10/11/2026 · Ramo: `revisao-fundacao` · Base: `main` @ `4b0ac7f`

Esta revisão foi feita só por leitura do código. Nenhum arquivo do app foi alterado. Antes de aplicar qualquer correção, há três avisos:

- **Não executei** testes, lint, build nem consultas ao banco: as dependências não estão instaladas e não há acesso ao banco do Lovable Cloud. Por isso, a análise das regras de acesso (RLS) é estática. A correção C1 propõe os testes automáticos que comprovam os quatro perfis.
- **Há um conflito de regras.** O `AGENTS.md` (bloco do Lovable) diz para não editar `supabase/migrations/` nem `drizzle/`, porque o banco é do Lovable. O pedido diz que as mudanças vão em migrações versionadas. **Proposta:** toda correção de banco desta revisão vira um texto pronto para enviar ao Lovable, que gera a migração. O Claude Code não escreve SQL de migração. Preciso da sua decisão sobre isso antes de aplicar.
- As migrações ficam em `drizzle/migrations/`, e não em `supabase/migrations/` como diz o plano. É o padrão atual do Lovable; a proposta é atualizar o plano, não mover os arquivos.

Legenda: **C** crítico · **A** alto · **M** médio · **B** baixo.

---

## Crítico

### C1. Qualquer pessoa pode criar conta e entra com acesso às duas empresas
- **Onde:** `src/routes/auth.tsx:50` (cadastro aberto e "Continuar com Google"); `drizzle/migrations/0000_base_schema.sql:313-335` (gatilho `ao_criar_usuario`).
- **Por que importa:** quem achar o endereço cria uma conta e o gatilho:
  1. vincula a conta a um vendedor de demonstração (Humberto, depois Clara) e entrega a carteira dele;
  2. ou cria um vendedor novo ligado a **todas** as empresas (linha 328);
  3. dá o papel `administrador` ao primeiro cadastro do banco (linha 331). Em produção, quem chegar primeiro vira administrador.
  Com isso, um estranho lê links internos, regras e equipes das duas empresas.
- **Correção:**
  - Desligar o cadastro público no Lovable Cloud (Auth → desativar *signups*) e entrar só por **convite** do administrador.
  - Restringir o Google a contas `@centerfrios.com` (ou ao domínio usado pela 381).
  - Na tela, trocar "Criar conta" por "Primeiro acesso? Peça seu convite ao administrador".
  - No banco (via Lovable): o gatilho deve só ligar `auth_user_id` a um `usuarios` **já pré-cadastrado pelo e-mail**. Sem pré-cadastro, sem acesso. Remover a regra do "primeiro usuário vira administrador" e criar o primeiro administrador por migração explícita.
  - Criar testes de RLS (pgTAP, ou um script com quatro usuários de teste) para os quatro perfis.

### C2. O vendedor consegue alterar a própria meta, vendas, pontos e selos
- **Onde:** `0000_base_schema.sql:291-300`. As políticas `inserir carteira` e `atualizar carteira` valem para `vendas`, `metas`, `pontos` e `selos`.
- **Por que importa:** pelo console do navegador, o vendedor pode baixar a própria meta, lançar vendas fictícias ou se dar pontos e selos. Isso quebra o ranking e a premiação, além do princípio "Shop9 é a fonte da verdade".
- **Correção (via Lovable):**
  - `vendas` e `orcamentos`: só leitura para `authenticated`. A escrita fica com `service_role`, pela integração ou importação.
  - `metas`: escrita só pela diretoria.
  - `pontos` e `selos`: escrita só por função no servidor (`security definer`).
  - `clientes`: o vendedor não altera `vendedor_id` (veja C4).

### C3. Administrador vê todos os dados comerciais
- **Onde:** `0000_base_schema.sql:230-233`. `ve_tudo()` inclui `administrador`, e é usada em todas as políticas de leitura.
- **Por que importa:** o plano diz que o administrador cuida só das configurações técnicas. Hoje ele lê a carteira, as vendas e a auditoria de todos, apaga dados da carteira (linha 298) e edita regras de negócio (linha 306), que são da diretoria.
- **Correção:**
  - `ve_tudo()` passa a valer só para `diretoria`.
  - O administrador ganha políticas próprias, apenas em `usuarios`, `usuario_empresas`, `user_roles`, `equipes`, `links` e nas futuras tabelas de conexões.
  - `configuracoes_regras` passa a ser editável só pela diretoria.
  - O apagamento de dados da carteira fica bloqueado para todos (dado vem do Shop9), exceto pela função de demonstração.

### C4. Remanejamento de cliente sem a regra dos 90 dias e sem auditoria
- **Onde:** a política `atualizar carteira` em `clientes` (`0000_base_schema.sql:297`). Não existe função de remanejamento.
- **Por que importa:** o supervisor pode mover qualquer cliente da equipe a qualquer momento, sem registro. A regra aprovada é: só depois de 90 dias sem compra, só pelo supervisor e com histórico.
- **Correção (via Lovable):**
  - Bloquear `update` de `clientes.vendedor_id` por RLS. Para isso, mover a coluna para fora do `update` liberado ou adicionar um gatilho que rejeita a troca.
  - Criar a função `remanejar_cliente(cliente_id, novo_vendedor_id, motivo)` (`security definer`), que confere:
    - o papel `supervisor` e se o cliente é da equipe dele;
    - `data_ultima_compra` com pelo menos `cliente_sem_compra_dias` dias, lido de `configuracoes_regras`;
    - e grava em `registro_auditoria`.
  - Criar testes.

### C5. Dias úteis ignoram feriados e o próprio teste está errado
- **Onde:** `src/regras/datas.ts:13-16` (`ehDiaUtil` olha só sábado e domingo); `src/regras/regras.test.ts:16,23`.
- **Por que importa:** 20/11 (Consciência Negra) é feriado nacional desde 2024. Novembro de 2026 tem **20** dias úteis, e não 21 como diz o teste. Isso altera a projeção, a meta do dia e o "orçamento parado" de todos os vendedores. Também faltam os feriados de Alagoas, como 16/09 (Emancipação Política), e os municipais de Maceió.
- **Correção:**
  - Tabela `feriados (empresa_id null = todas, data, nome, abrangencia: nacional|estadual|municipal, origem, created_at)`, editável pela diretoria, criada via Lovable com os feriados de 2026–2027.
  - Em `src/regras/datas.ts`, `ehDiaUtil(d, feriados: Set<string>)`. As funções de dias úteis passam a receber esse conjunto, que é obrigatório para não ser esquecido.
  - Corrigir o teste para 20 e criar casos: mês com feriado, feriado numa sexta (orçamento parado), primeiro dia útil do mês e último dia útil.

### C6. Compra recente não tira o cliente de "esquecido"
- **Onde:** `src/modulos/inicio/calcular.ts:62-68,92` e `src/regras/carteira.ts:72-79`.
- **Por que importa:** a "última interação qualificada" considera só a tabela `interacoes`. Pela definição aprovada, compra faturada também é interação qualificada. Hoje, um cliente que comprou ontem aparece como "Esquecido" no plano do dia, como acontece com "Açougue Estrela" no print. Isso gera alerta falso e tira a confiança do time.
- **Correção:** criar a função pura `ultimaInteracaoQualificada(interacoes, vendas)` em `src/regras/carteira.ts`, que considera as duas fontes, com testes. Usá-la em `calcular.ts`.

### C7. Regras de negócio misturam as duas empresas
- **Onde:** `src/modulos/inicio/dados.ts:28`. `configuracoes_regras` é lida sem filtro de empresa, e `montarConfiguracao` (`src/regras/configuracoes.ts:22-26`) fica com o último valor que chegar.
- **Por que importa:** se a diretoria der limites diferentes à 381, um vendedor das duas empresas vê alertas com o limite errado, que muda a cada carregamento.
- **Correção:**
  - Filtrar por `empresa_id`.
  - Calcular o painel **por empresa** e somar só os totais. Os limites de alerta valem para os clientes da empresa de cada um.
  - Criar um teste de `montarConfiguracao` com duas empresas.

### C8. Faturado do mês pode sair truncado
- **Onde:** `src/modulos/inicio/dados.ts:22-23`, com `.range(0, 9999)`.
- **Por que importa:** a API do Supabase devolve no máximo 1.000 linhas por consulta (padrão `max_rows`), mesmo pedindo 10.000. Com a carteira real, vendas e interações de 12 meses passam disso, e o **faturado, a meta do dia e a recompra saem errados sem nenhum aviso**.
- **Correção:** criar a função `painel_vendedor(empresa_id, vendedor_id, hoje)` no banco (via Lovable). Ela devolve agregados prontos: faturado do mês, faturado até ontem, datas das últimas N compras por cliente e última interação qualificada por cliente. A tela só recebe números. As regras puras continuam em `src/regras`, que é a referência testada, e a função SQL ganha teste comparando com elas.

### C9. Dados de demonstração entram em produção
- **Onde:** `drizzle/migrations/0001_dados_demonstracao.sql` e `0002_equilibrar_demo.sql`.
- **Por que importa:** são migrações, então rodam em todo ambiente novo, inclusive em produção. Além disso, as empresas reais são criadas com `demo = true` (linhas 10-11), e o botão de apagar não apaga equipes nem limpa o vínculo de Marcos com a equipe.
- **Correção (via Lovable):**
  - Criar as empresas com `demo = false`.
  - Mover os dados fictícios para uma função `carregar_dados_demo()`, chamada só em homologação ou pelo administrador.
  - `apagar_dados_demo()` também apaga `equipes`, `usuario_empresas` e `tarefas` com `demo`.
  - Criar um teste que conta as linhas reais antes e depois do apagamento.

---

## Alto

### A1. O usuário pode alterar o próprio perfil, a empresa e a equipe
- **Onde:** `0000_base_schema.sql:280-281`. A política `atualizar próprio usuário` libera todas as colunas.
- **Por que importa:** o vendedor muda `perfil`, `empresa_id`, `equipe_id` e `demo` na própria linha. O `perfil` é lido pela tela (`src/modulos/sessao/sessao.tsx:18`), e trocar de equipe tira o vendedor do supervisor.
- **Correção (via Lovable):** liberar só as colunas `apelido_copiloto` e `tema`, com `grant update (apelido_copiloto, tema)`. Remover `usuarios.perfil` e usar só `user_roles` como fonte de papéis; hoje são duas fontes da mesma informação.

### A2. A auditoria aceita registros falsos e o supervisor não lê nada
- **Onde:** `0000_base_schema.sql:308-310`.
- **Por que importa:** qualquer usuário insere qualquer `acao` em `registro_auditoria`. Um registro que o próprio usuário escreve não serve de prova. Além disso, o supervisor não lê nem as ações que ele mesmo fez.
- **Correção:** tirar o `insert` de `authenticated`; só funções `security definer` e gatilhos gravam auditoria. Criar gatilhos de auditoria em `metas`, `configuracoes_regras`, `user_roles` e `clientes.vendedor_id`. Dar ao supervisor leitura das linhas da própria equipe.

### A3. Faltam colunas do modelo em algumas tabelas
- **Onde:** `0000_base_schema.sql`:
  - `user_roles` (50-55): sem `empresa_id`, `created_at` e `origem`. Hoje o papel vale para as duas empresas; por exemplo, não dá para ser supervisor na 381 e vendedor na CENTERFRIOS.
  - `empresas` (7, 14): `empresa_id` fica nulo nas linhas novas, porque o `update` roda com a tabela vazia.
  - `usuario_empresas`: sem `demo`.
- **Correção (via Lovable):** adicionar `empresa_id` (nulo = todas), `created_at` e `origem` em `user_roles`, e fazer `has_role(_user, _role, _empresa)` considerar a empresa. Em `empresas`, remover `empresa_id` (é ela mesma) ou preencher por gatilho.

### A4. Faltam índices nas colunas usadas pelos filtros e pela RLS
- **Onde:** `0000_base_schema.sql:213-217`.
- **Por que importa:** toda consulta filtra `empresa_id` + `vendedor_id` + data, e a RLS chama `tem_empresa`/`pode_ver_vendedor` linha a linha. Sem índice, o painel fica lento quando chegarem os dados do Shop9.
- **Correção (via Lovable):** criar índices `(empresa_id, vendedor_id)` em `clientes`; `(empresa_id, vendedor_id, data_faturamento)` em `vendas`; `(empresa_id, vendedor_id, data)` em `interacoes`, `alertas` e `tarefas_agenda`; `(cliente_id)` em `orcamentos` e `tarefas_agenda`; `(empresa_id, vendedor_id, data)` em `pontos`; `usuarios(auth_user_id)` já é `unique`. Nas políticas, chamar as funções como `(select public.ve_tudo())` para o Postgres calcular uma vez por consulta.

### A5. Datas em UTC: contatos depois das 21h caem no dia seguinte
- **Onde:** `src/modulos/inicio/calcular.ts:56,65,69` usa `i.data.slice(0,10)` sobre `timestamptz`, que vem em UTC. O mesmo erro aparece em `src/modulos/inicio/PainelInicio.tsx:48` (`toISOString`).
- **Por que importa:** Maceió é UTC−3. Um contato às 21h30 conta para amanhã: não entra na cobertura de hoje e some da meta do dia.
- **Correção:** criar `paraDataLocal(timestamp)` em `src/regras/datas.ts`, com fuso `America/Maceio` explícito, e testes de borda (23h59 e 00h01). Usar em `calcular.ts`.

### A6. Lógica de negócio fora de `src/regras` e sem teste
- **Onde:** `src/modulos/inicio/calcular.ts` inteiro, com prioridade do plano do dia, reativação, meta do dia por indicador e cobertura do dia.
- **Por que importa:** são as regras que o vendedor mais vê, e nenhuma tem teste. A meta diária de cobertura também diverge do plano: o código usa "o que falta ÷ dias restantes", e o plano define "meta mensal ÷ dias úteis do mês".
- **Correção:** mover para `src/regras/painel.ts` como funções puras: `prioridadeDoPlano`, `reativados` e `metasDoDia`, cada uma com teste. Antes, confirmar com a diretoria qual fórmula de cobertura diária vale; a do plano é a aprovada. `calcular.ts` fica só como montagem.

### A7. Integrações: faltam contratos e há chamadas diretas ao banco nas telas
- **Onde:** `src/integracoes/tipos.ts`. Há só vendas, mensagens e copiloto. Faltam **Instagram** e **voz (ElevenLabs)**, e a interface do Shop9 cobre apenas importação. Além disso, telas e componentes chamam `supabase` direto: `RegistrarContato.tsx:56,61`, `BuscaGlobal.tsx:23`, `mais.tsx:35`, `Cabecalho.tsx` e `__root.tsx:143`.
- **Por que importa:** o banco próprio pode ficar nas telas, por meio de hooks, mas a regra é "toda fonte externa atrás de interface". Sem os contratos de Instagram e voz, a Fase 3 vai nascer acoplada.
- **Correção:** adicionar `FonteInstagram` e `Voz` com implementação `manual` (sem conexão; devolve "não conectado") e trocar `FonteVendas` por `FonteShop9` (`clientes`, `vendas`, `orcamentos`). Tirar o acesso ao banco dos componentes e levá-lo para hooks em `src/modulos/<módulo>/dados.ts`, como `useRegistrarContato`, `useBuscaClientes` e `useApagarDemo`.

### A8. Login sem recuperação de senha e sem chave de acesso
- **Onde:** `src/routes/auth.tsx`.
- **Por que importa:** não há "Esqueci minha senha", e o vendedor que esquecer a senha fica parado. O plano também pede gerenciador de senha (já funciona, pelo `autocomplete`) e chave de acesso (passkey), além de verificação em duas etapas para diretoria e administradores.
- **Correção:** adicionar o fluxo "Esqueci minha senha" com `resetPasswordForEmail` e a rota `/redefinir-senha`, além do botão "Mostrar senha" (`aria-pressed`). Ativar MFA no Lovable Cloud para diretoria e administradores. Passkey fica para quando o Lovable Cloud oferecer.

### A9. Faltam lint e testes de acessibilidade
- **Onde:** `eslint.config.js` não tem `eslint-plugin-jsx-a11y`. Não há Playwright nem axe, e o único teste de tela é `src/test/app-routing.test.tsx`.
- **Correção:**
  - Adicionar `eslint-plugin-jsx-a11y` (`recommended`).
  - Adicionar `@playwright/test` + `@axe-core/playwright`, com `e2e/a11y.spec.ts` percorrendo `/auth`, `/design-system`, `/inicio`, `/conversas`, `/clientes`, `/agenda` e `/mais` nos dois temas e a 360 px.
  - As rotas autenticadas usam um usuário de teste de homologação (credenciais no `.env.local`, fora do git).
  - Scripts `test:e2e` e `lint`.

### A10. A página /design-system mostra o tema errado no modo escuro
- **Onde:** `src/routes/design-system.tsx:35`. O painel "claro" não força o tema claro.
- **Por que importa:** com o app no escuro, `html.dark` vale para a página toda, e os dois painéis aparecem escuros.
- **Correção:** criar a classe `.claro` em `src/styles.css` com as variáveis do `:root`, e aplicá-la ao painel claro.

### A11. A meta "Cobertura" do cabeçalho some no celular
- **Onde:** `src/modulos/layout/Cabecalho.tsx:64` (`hidden ... lg:inline-flex`).
- **Por que importa:** o plano pede o selo de cobertura "sempre visível em todas as telas". Hoje ele aparece só no desktop largo, e quem mais precisa é o vendedor no celular.
- **Correção:** versão compacta, só o percentual com ícone, visível em todos os tamanhos, com `aria-label` igual ao atual.

---

## Médio

### M1. O design system Polar não segue as três camadas de tokens
- **Onde:** `src/styles.css:62-131`.
- **Por que importa:** os tokens seguem os nomes do shadcn (`--primary`, `--muted-foreground`). Não há camada de primitivos (`azul-700`, `amarelo-400`) nem de componentes (`--botao-primario-fundo`, `--cartao-borda`), e os semânticos não usam `--cor-*` como o plano define. Trocar a marca hoje significa caçar valores repetidos.
- **Correção:** acrescentar, sem quebrar o shadcn:
  - primitivos `--polar-azul-900…100`, `--polar-ouro-400/500`, `--polar-cinza-*` e `--polar-noite-*`;
  - semânticos `--cor-fundo` etc., apontando para os primitivos;
  - as variáveis do shadcn apontando para os semânticos.
  Os valores atuais **batem com a paleta** de `docs/estrategia.md`, conferidos par a par nos comentários de cada linha. Não há cor errada, só falta de estrutura.

### M2. Raios e pesos fogem do Polar
- **Onde:** `src/styles.css:63,153` (cartão com 12 px; o plano pede 8 px); botões com `rounded-md` = 8 px (o plano pede 6 px); títulos em `font-extrabold` (800), em `PainelInicio.tsx:49`, `auth.tsx:68` e `design-system.tsx`. A própria página diz "12 px em cartões e 8 px em botões" (`design-system.tsx:106`), contra o plano.
- **Correção:** `--radius-cartao: 8px` e `--radius-botao: 6px`, com títulos em semibold ou bold, como pede a "assinatura premium". Diretoria decide: manter 12 px, que fica bom no print, e atualizar o plano, ou seguir o plano.

### M3. Ouro aparece num lugar onde não deveria
- **Onde:** `src/components/ui/button.tsx:19` (variante `ouro`), exibida como botão em `design-system.tsx:62`.
- **Por que importa:** pela regra, o ouro nunca vai em botões comuns. O restante está certo: `SeloStatus` "conquista", ponto atingido no `GraficoAnel` e no `Progresso`, e detalhe do Pinguim.
- **Correção:** remover a variante `ouro` do botão e o exemplo dela da página. Mostrar lá um exemplo de "uso errado", como o plano pede.

### M4. Cores fixas fora dos tokens
Lista completa (fora de `components/ui`):
- `src/routes/__root.tsx:91`: `theme-color` `#1B4FA0`. Deve virar duas metas, `media="(prefers-color-scheme: dark)"` com `#0A1730`.
- `src/lib/error-page.ts:9-16`: página de erro do servidor em cinza genérico (`#fafafa`, `#111`, `#4b5563`, `#d1d5db`). É gerada pelo Lovable; pedir a troca para os valores do Polar ou deixar como está, por ser página de falha.
- `src/routes/auth.tsx:93`: cores do logotipo do Google. É uma **exceção correta** (marca de terceiro).
- `src/design-system/Progresso.tsx:11`: `bg-[var(--trilha)]`. `--trilha` existe só como variável, sem token no `@theme`; registrar como `--color-trilha`.
- `public/manifest.webmanifest`: `#F7F8FB` e `#1B4FA0`. Aceitável, porque o manifesto não lê CSS.

### M5. Busca global ignora a empresa escolhida
- **Onde:** `src/modulos/layout/BuscaGlobal.tsx:23,46`.
- **Por que importa:** traz até 500 clientes de todas as empresas visíveis, e escolher um cliente leva para `/clientes`, não para a ficha dele.
- **Correção:** filtrar pelas `useEmpresasAtivas()`, buscar no servidor pelo texto digitado (`ilike`, 20 resultados) e levar a `/clientes/$id` quando a ficha existir.

### M6. Tema escolhido não acompanha o usuário entre aparelhos
- **Onde:** `src/design-system/tema.tsx:16-19` lê só o `localStorage`. `__root.tsx:141-144` grava no banco, mas ninguém lê de volta.
- **Correção:** ao carregar a sessão, aplicar `usuarios.tema` quando for diferente do salvo localmente.

### M7. Consultas repetidas e carregamento pesado
- **Onde:** o `Cabecalho` chama `usePainel` em todas as telas (`Cabecalho.tsx:24`), o que roda as oito consultas do painel até em `/agenda`. O logo é um PNG de 213 KB (`src/assets/logo-centerfrios.png.asset.json`) carregado em toda tela, e o Recharts é usado só para desenhar um anel.
- **Correção:**
  - Com C8, o cabeçalho passa a usar uma consulta leve (`cobertura_vendedor`) e o painel usa a função agregada.
  - O logo vira SVG (veja a proposta no fim).
  - Trocar o `PieChart` do `GraficoAnel` por um SVG de dois círculos: menos código e animação controlada pelo Polar.

### M8. Estados de carregamento, vazio e erro incompletos
- **Onde:**
  - `/conversas`, `/clientes` e `/agenda` só têm estado vazio, o que é aceitável enquanto não há dados.
  - O painel tem esqueleto e erro, mas o erro não traz botão "Tentar de novo" (`PainelInicio.tsx:52`).
  - Vendedor não vinculado mostra só um parágrafo, sem `h1` (`PainelInicio.tsx:42-43`).
  - O cabeçalho não mostra nada se o painel falhar.
- **Correção:** componente `EstadoErro` no Polar (título, o que aconteceu, botão "Tentar de novo" com `refetch`), usado no painel e nos futuros módulos. O caso do não vinculado vira um `EstadoVazio` com `h1`.

### M9. PWA instala, mas sem os recursos prometidos
- **Onde:** `public/manifest.webmanifest`, `public/icon-*.png`.
- **Por que importa:**
  - O ícone é um recorte do logo antigo, com o Pinguim cortado e o texto ilegível em 192 px.
  - `"purpose": "any maskable"` num ícone só faz o Android cortar as bordas.
  - Não há service worker, então não há tela offline nem push, que o plano promete.
  - Falta `id` no manifesto.
- **Correção:**
  - Ícones novos da marca Rota (veja a proposta), separados em `any` e `maskable`.
  - `"id": "/inicio"` e `"display_override": ["standalone"]`. "Tela cheia" no plano significa sem barra do navegador, o que o `standalone` já entrega.
  - Service worker mínimo, com página offline, agora; push fica para a Fase 2.

### M10. Dados de demonstração não cobrem todos os casos
- **Onde:** `0001_dados_demonstracao.sql`.
- **Por que importa:** geram atenção, urgente, esquecido, 90+ dias e orçamento parado. Ficam de fora: cliente com **menos de 3 compras** ("sem histórico"), cliente que **nunca comprou**, feriado no mês e "aguardando resposta", que entra na Fase 2. As cidades e telefones são de Pernambuco (DDD 81); a CENTERFRIOS é de Maceió (DDD 82).
- **Correção:** na nova `carregar_dados_demo()` (C9), incluir esses casos e cidades de Alagoas.

---

## Baixo

### B1. Acessibilidade: pontos pequenos encontrados na leitura
Estes já estão **certos**: link "Pular para o conteúdo" (`Estrutura.tsx:11`), `main` com `tabIndex=-1`, um `h1` por tela, seções com `aria-labelledby`, `aria-current` na navegação, botões com no mínimo 44 px (`button.tsx:23-26`), status com ícone e palavra, gráficos com resumo e tabela, região `aria-live` (`Anunciador.tsx`) e `prefers-reduced-motion` global (`styles.css:172`).

O que falta ajustar:
- `PainelInicio.tsx:166`: o "✓ Concluída" é lido como "marca de verificação". Usar ícone com `aria-hidden` e texto.
- `PainelInicio.tsx:183`: o plano do dia é uma `ol` com `h3` por cliente (correto), mas os três botões repetem o nome via `sr-only`. Melhor usar `aria-describedby` para o nome, para o leitor de tela não ler o nome três vezes por item.
- `Agendar` (`PainelInicio.tsx:208`) leva a `/agenda` sem o cliente. Passar `search={{ cliente: id }}` quando a agenda existir.
- `RegistrarContato.tsx`: os botões de opção com `aria-pressed` funcionam, mas o padrão do Polar para escolha única deveria ser `RadioGroup` (setas do teclado, um item de tabulação por grupo). O erro geral fica ligado ao `form`, e não ao primeiro campo pendente; levar o foco até ele.
- O seletor de empresa no celular fica dentro do menu do usuário (dois toques). Aceitável; o plano pede um.
- `auth.tsx:99`: o "Criar conta" é `Button variant="link"`, o que está certo por ser uma ação na mesma tela. Ficará obsoleto com C1.
- Itens que **só dá para confirmar rodando** e que entram no axe/Playwright (A9): contraste final de `text-muted-foreground` sobre `bg-primary-suave`, reflow a 320 px no plano do dia (os três botões quebram linha, o que parece certo no código), zoom de 200% e foco visível sobre a barra inferior fixa, porque o `main` precisa de `scroll-padding-bottom`.

### B2. `normalizarTelefone` falha com DDD 55
- **Onde:** `src/integracoes/manual.ts:5-8`.
- **Por que importa:** um número do RS (DDD 55) sem DDI começa com "55" e não recebe o prefixo do país.
- **Correção:** decidir pelo tamanho: 10 ou 11 dígitos é número nacional e ganha o 55; 12 ou 13 dígitos já tem o DDI. Criar teste.

### B3. Tipos e organização
- Nenhum `any` no código do projeto, e `strict: true` está ativo. ✔
- Ainda assim: `as Interacao[]` (`dados.ts:37`) e `as Sessao["usuario"]` (`sessao.tsx:24`) escondem diferenças entre o banco e o tipo. Gerar o tipo a partir de `Database` (`src/integrations/supabase/types.ts`) em vez de forçar.
- `noUnusedLocals: false` e a regra `no-unused-vars` desligada permitem código morto. Ligar no lint, como aviso.
- Pastas: `src/design-system`, `src/modulos`, `src/regras` e `src/integracoes` existem como no plano. `src/hooks/use-mobile.tsx` e `src/lib` vêm do Lovable; manter.

### B4. Acabamento
- `README.md:3`: a linha "Implement exactly the screenshot and nothing else" sobrou de um prompt. Remover.
- `package.json`: `"name": "tanstack_start_ts"`. Trocar para `rota-centerfrios`.
- `.env` versionado. Contém só a chave **publicável** do Supabase, que é pública por natureza, então não há vazamento. Mesmo assim, recomendo não versionar `.env` e deixar no repositório só um `.env.example`, para evitar que um segredo entre por engano no futuro.
- `Logo` com `alt="CENTERFRIOS"`: na marca nova, o nome acessível passa a ser "Rota CENTERFRIOS".

---

## Respostas diretas ao checklist

| Pergunta | Resposta |
| --- | --- |
| Tabelas com `empresa_id`, `created_at`, `origem`? | Sim em todas as de dados. Faltam em `user_roles` (A3). |
| RLS em todas as tabelas? | Sim, ligada nas 17. As **regras** estão erradas para administrador (C3) e para escrita do vendedor (C2, A1). |
| Vendedor só vê a própria carteira? | Sim, na leitura. |
| Supervisor só vê a equipe? | Sim, na leitura; mas remaneja sem regra (C4). |
| Diretoria vê tudo? | Sim. |
| Administrador só configurações técnicas? | **Não** (C3). |
| Usuário nas duas empresas vê os dados certos? | Os dados sim, as **regras** não (C7). |
| Segredo exposto no navegador? | Não. Só a chave publicável; `client.server.ts` não é importado por código de tela. |
| Migrações versionadas? | Sim, em `drizzle/migrations` e geridas pelo Lovable (veja o aviso no topo). |
| Índices nos filtros? | Parciais (A4). |
| Regras em `src/regras` com testes? | Parcialmente: faltam feriados (C5), fuso (A5), compra como interação (C6) e as regras do painel (A6). |
| Limites vindos de `configuracoes_regras`? | Sim, com `REGRAS_PADRAO` só como reserva; mas sem filtro de empresa (C7). |
| Integrações atrás de interface? | Em parte (A7). |
| Dados demo geram todos os alertas? | Quase todos (M10). O botão apaga só demo, mas as migrações rodam em produção (C9). |

## Testes de regra que serão criados (etapa de correção)
- **Atingimento:** meta zero; faturado zero (mês sem vendas); acima de 100%.
- **Projeção:** primeiro dia útil; fim de semana antes do primeiro dia útil (zero dias decorridos); mês com feriado.
- **Meta do dia:** último dia útil; depois do último dia útil (zero restantes); meta já batida; feriado entre hoje e o fim do mês.
- **Cobertura:** carteira vazia (divisão por zero); compra no mês sem interação; interação de outro cliente fora da carteira; contato às 23h59 e às 00h01 (fuso).
- **Recompra:** 2 compras (sem histórico); 3 compras no mesmo dia (intervalo zero); limites exatos de 1,5× e 2×; limites vindos da configuração.
- **Esquecido:** nunca contatado; compra recente sem interação (C6); exatamente 30 dias.
- **90 dias:** exatamente 90; sem compra nenhuma.
- **Orçamento parado:** sexta → segunda; feriado no meio; interação no mesmo dia.
- **Dias úteis:** novembro/2026 = 20; setembro/2026 com 16/09 (Alagoas).

## Ordem proposta para as correções (depois da sua aprovação)
1. **Banco, via Lovable:** C1, C2, C3, C4, C9, A1, A2, A3, A4, feriados (C5) e a função agregada (C8). Eu escrevo os textos para o Lovable; ele gera as migrações.
2. **Regras no ramo `revisao-fundacao`:** C5, C6, C7, A5, A6, B2, com testes. Um commit por regra.
3. **Arquitetura:** A7, M5, M7, M8.
4. **Polar e acessibilidade:** A9, A10, A11, M1–M4, B1.
5. **Login e marca:** A8, nova tela de login e nova marca (proposta abaixo).
6. **PWA:** M9.
7. **Acabamento:** B3, B4, M6, M10.

Cada passo vira commits pequenos em português, sem reescrever telas inteiras.

---

## Proposta: marca Rota e nova tela de login (para aprovar)

### Logomarca (versão 3: o pinguim da marca na rota)
Imagem: [`docs/proposta/apresentacao.png`](proposta/apresentacao.png). Arquivos:
- [`rota-simbolo.svg`](proposta/rota-simbolo.svg): ícone do app e da PWA.
- [`rota-logo.svg`](proposta/rota-logo.svg): assinatura para fundo claro.
- [`rota-logo-escuro.svg`](proposta/rota-logo-escuro.svg): assinatura para o tema escuro.
- [`rota-favicon.svg`](proposta/rota-favicon.svg): versão para 16 a 64 px.

**O conceito:** o **pinguim da CENTERFRIOS, redesenhado em vetor a partir do logo oficial** (mesma silhueta, bico e peito branco em "J"), de pé sobre uma **rota**. A linha vem de longe, surgindo aos poucos, passa sob os pés e termina no **ponto ouro**, a meta atingida.

**A adaptação ao Polar:**
- O preto vira azul-noite (`#0A1730`) e o círculo vira um ícone de cantos arredondados, em degradê azul profundo.
- O ouro aparece uma vez só, no ponto de chegada.
- O pinguim fica igual ao da loja: o cliente e o vendedor reconhecem na hora. O símbolo também serve para qualquer nome (Rota, Norte ou Pulso).

**Pendências:**
- Converter os textos da assinatura em contornos (*paths*) e gerar os PNG da PWA.
- **Símbolo aprovado em 10/11/2026.** A aplicação no app (login, cabeçalho, PWA) espera a escolha do nome. **Nada aplicado no app.**
- As tentativas anteriores, em traço, ficam em `docs/proposta/variacoes/` só como histórico.

### Tela de login
Mantém a estrutura atual (campo, campo, botão, Google), que já está correta e acessível, e muda a apresentação.

**Desktop: duas colunas.**
- **Esquerda:** fundo azul-noite com o **símbolo animado**, uma frase de valor ("Nenhum cliente esperando, nenhum cliente esquecido.") e uma trilha sutil de pontos.
- **Direita:** cartão de vidro (`backdrop-filter: blur`, borda de 1 px a 12% de opacidade, superfície a 70%) com o formulário.

**Celular:** uma coluna. O símbolo fica no topo e o cartão ocupa a largura.

**Movimento**, em 180–600 ms com curva `--ease-polar`:
1. **Entrada** (só no primeiro carregamento): a linha da Rota se desenha (`stroke-dashoffset`, 600 ms) → o ponto ouro acende com um pulso único → o cartão sobe 8 px e aparece (220 ms, com 80 ms de atraso).
2. **Fundo vivo e discreto:** duas manchas de luz azul que derivam devagar (40 s, opacidade ≤ 12%). Sem partículas, sem distrair.
3. **Hover e foco:**
   - O botão "Entrar" ganha um brilho que atravessa da esquerda para a direita (300 ms) e sobe 1 px.
   - Os campos ganham um anel azul que cresce de 0 para 3 px.
   - O botão Google ganha fundo translúcido.
   - Todos os estados existem também em `:focus-visible`, para quem usa teclado.
4. **Feedback:**
   - Ao enviar, o texto do botão vira "Entrando…" com a linha da Rota correndo dentro dele.
   - Num erro, o cartão faz um balanço de 2 px (uma vez) e a mensagem aparece em `role="alert"`, junto ao campo.
   - No sucesso, o ponto ouro cresce e leva ao Início.
5. **Movimento reduzido:** com `prefers-reduced-motion`, tudo vira esmaecimento simples de 150 ms. Sem desenho de linha, sem deriva e sem balanço.

**Acessibilidade e conversão:**
- Rótulos visíveis e "Mostrar senha".
- "Esqueci minha senha" (A8) e "Primeiro acesso? Peça seu convite" (C1).
- Alvos de 48 px, contraste AA no vidro, com superfície mínima de 70% de opacidade e conferida no axe.
- `autocomplete` correto e um `h1`.
- Funciona a 320 px e com zoom de 200%.

**Implementação:**
- CSS e SVG puros, sem nova biblioteca de animação. O `tw-animate-css` já está no projeto.
- Mexe só em `src/routes/auth.tsx`, em `src/design-system/Logo.tsx` e num novo `src/design-system/SimboloRota.tsx` (o símbolo animável, reaproveitado no carregamento e na comemoração da meta).

---

## CLAUDE.md proposto
Preparado em [`docs/proposta/CLAUDE.md`](proposta/CLAUDE.md), **sem aplicar** na raiz. Depois da sua aprovação, ele vai para a raiz e o mesmo texto vai para o conhecimento do projeto no Lovable. O `AGENTS.md` atual fica como está (o bloco do Lovable é dele).
