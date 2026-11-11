# Rota CENTERFRIOS — regras do projeto

Plataforma comercial dos vendedores CENTERFRIOS e 381 Distribuidora. O plano completo está em `docs/estrategia.md`; em caso de dúvida, ele vale. Este arquivo também vai para o conhecimento do projeto no Lovable.

## Quem faz o quê (decisão de 11/11/2026)
- **O Claude Code constrói tudo no projeto:** regras de negócio, telas, componentes, ajustes visuais, testes e documentação.
- **O Lovable só gera as migrações do banco e publica.** Cada mudança de banco é escrita pelo Claude Code como texto em `docs/lovable/NN-assunto.md` (o que criar ou alterar e como conferir), enviada ao Lovable e conferida depois, lendo a migração gerada.
- O Claude Code não escreve SQL de migração nem edita `drizzle/` ou `supabase/migrations/`.

## Convivência com o Lovable
- O Lovable trabalha no `main`. O Claude Code trabalha **sempre em ramo separado** e só junta ao `main` por pull request revisado. Nunca reescrever histórico já publicado (sem force push, rebase, amend ou squash de commits enviados).
- Não pedir ao Lovable mudanças de tela; se for inevitável, nunca na mesma tela em que o Claude Code está trabalhando.
- **Banco de dados:** mudanças só por migração versionada gerada pelo Lovable em `drizzle/migrations/`. Nunca editar o banco à mão. Sempre incluir RLS, índices, auditoria quando houver dado sensível e teste de acesso na mesma mudança. Carga de dados que precisa existir em todo ambiente vai numa função (ex.: `carregar_feriados_nacionais()`) e entra em `docs/lancamento.md`.
- `docs/lancamento.md` é o checklist do primeiro uso real; mantenha-o atualizado a cada passo.
- Não editar arquivos gerados: `src/routeTree.gen.ts`, `src/integrations/supabase/*` e os que dizem "automatically generated".
- Segredos ficam nos *Secrets* do Lovable Cloud, nunca no repositório nem em código do navegador.
- Corrigir o mínimo que resolve. Não reescrever telas inteiras sem necessidade.

## Pastas
- `src/design-system/` — tokens e componentes do Polar.
- `src/modulos/<módulo>/` — telas e hooks de dados do módulo (`inicio`, `conversas`, `clientes`, `agenda`, `orcamentos`, `links`, `gestao`, `layout`, `sessao`). O acesso ao banco fica em `dados.ts` (hooks), nunca dentro de componente.
- `src/regras/` — funções puras de indicadores e alertas, com testes. Sem React, sem Supabase, sem `new Date()` interno: a data de hoje, a configuração e os feriados entram por parâmetro.
- `src/integracoes/` — contratos de toda fonte externa (Shop9, WhatsApp, Instagram, IA, voz), cada um com uma implementação `manual` que funciona. As telas usam só a interface, pelo objeto `integracoes`.
- `src/components/ui/` — base do shadcn/ui; ajustar só para alinhar ao Polar.
- Nomes em português claro, iguais aos da interface (`CartaoDeIndicador`, `seloCobertura`).

## Regras de negócio (definições aprovadas)
- **Atingimento** = vendas faturadas no mês ÷ meta do mês. Meta zero → 0.
- **Projeção** = faturado até hoje ÷ dias úteis decorridos × dias úteis do mês.
- **Meta do dia** = (meta − faturado até ontem) ÷ dias úteis restantes (incluindo hoje). Nunca negativa.
- **Meta diária de cobertura** = (meta mensal de cobertura − cobertura atingida) ÷ dias úteis restantes, em clientes, arredondada para cima.
- **Cobertura** = clientes da carteira com interação qualificada no mês ÷ clientes da carteira. Carteira vazia → 0.
- **Interação qualificada:** o cliente respondeu, visita ou ligação com resultado, ou compra faturada no mês. Mensagem sem resposta não conta.
- **Recompra:** intervalo médio entre compras (mínimo de 3). "Atenção" a partir de 1,5×; "Urgente" a partir de 2×.
- **Cliente esquecido:** 30 dias ou mais sem interação qualificada (compra conta).
- **90 dias sem compra:** pode ser remanejado, só pelo supervisor, com registro na auditoria (função `remanejar_cliente`).
- **Orçamento parado:** 2 dias úteis sem interação.
- Todos os limites vêm de `configuracoes_regras`, **por empresa**. Nunca fixar no código; `REGRAS_PADRAO` é só reserva.
- **Dias úteis** descontam fins de semana e todas as datas da tabela `feriados` (abrangência nacional, estadual, municipal ou empresa, tratadas igual), editável pela diretoria em Configurações → Feriados e dias sem expediente. As funções de `src/regras/datas.ts` recebem o conjunto de feriados como parâmetro obrigatório.
- **Datas** no fuso `America/Maceio`; nunca usar `toISOString().slice(0,10)` para o "dia" de um evento.
- **Agregações** grandes (faturado, histórico de compras) rodam no banco; a API devolve no máximo 1.000 linhas por consulta.

## Perfis e acesso (garantidos por RLS)
- **Vendedor:** a própria carteira, conversas, meta e agenda. Não altera vendas, metas, pontos nem selos.
- **Supervisor:** a equipe. Remaneja só pela função auditada.
- **Diretoria:** tudo, nas duas empresas. Dona de metas, regras, modelos e links.
- **Administrador:** só configurações técnicas (usuários, vínculos, conexões, central de links). Não lê dados comerciais.
- Toda tabela de dados tem `empresa_id`, `created_at`, `origem` (`manual` | `importacao` | `integracao`) e, quando aplicável, `demo`.
- Acesso só por convite (pré-cadastro em `usuarios` + `papeis_pre_cadastro`), e só com e-mails `@centerfrios.com` e `@grupo381.com.br`, inclusive no login com Google.

## Design system Polar
- Use **só tokens e componentes do Polar**. Nada de cor fixa (`#hex`, `bg-blue-500`, `text-white`); a exceção é a marca de terceiros (ex.: logo do Google).
- Tokens em três camadas: primitivos (`--polar-azul-700`) → semânticos (`--cor-fundo`, `--cor-texto`, `--cor-primaria`, `--cor-destaque`, `--cor-sucesso`, `--cor-atencao`, `--cor-perigo`) → componentes (`--botao-primario-fundo`, `--cartao-borda`).
- Paleta e contrastes: tabela "Paleta proposta do Polar" em `docs/estrategia.md`.
- **Ouro** só em conquistas, selos e ponto atingido da meta. Nunca em botão comum e nunca como cor de texto sobre fundo claro.
- **Tipografia:** Plus Jakarta Sans nos títulos; Inter no texto; `numeros` (algarismos tabulares) em valores e percentuais; tamanhos em `rem` (escala 12 · 14 · 16 · 20 · 24 · 32 px); corpo de 16 px.
- Cantos: 12 px nos cartões e 8 px nos botões.
- Grade de 4 px. Bordas finas, sombras mínimas. Animações de 150 a 250 ms (até 600 ms em momentos de marca), sempre desligadas com `prefers-reduced-motion`.
- Ícones lucide de traço fino, sempre com rótulo ou nome acessível.
- Componente novo do Polar entra também na rota `/design-system`, nos dois temas.

## Semântica e acessibilidade (WCAG 2.2 AA)
- `header`, `nav`, `main`, `aside`; `section` com `aria-labelledby`; listas em `ul`/`ol`; tabelas em `table`; datas em `time`; valores calculados em `output`.
- `button` para ações e `a`/`Link` para navegação, sem exceção.
- Um `h1` por tela; seções em `h2`, sem pular níveis.
- Foco sempre visível e nunca escondido pelas barras fixas. Ordem de tabulação lógica. Link "Pular para o conteúdo".
- Alvos de toque de no mínimo 44×44 px.
- Status nunca só por cor: ícone e palavra (`SeloStatus`).
- Gráficos com resumo em texto e "Ver como tabela" (`GraficoAnel`).
- Avisos dinâmicos via `useAnunciar` (`aria-live`), sem roubar o foco.
- Formulários com rótulo visível, erro em texto junto ao campo (`aria-describedby`, `aria-invalid`) e foco no primeiro erro.
- Funciona a 320 px de largura e com zoom de 200%, sem rolagem horizontal.
- Tudo que se arrasta também tem botão equivalente.

## Comandos
- `bun install`, `bun run dev`, `bun run test`, `bun run lint`, `bun run test:e2e` (Playwright + axe).

## Definição de pronto (toda tarefa)
- [ ] Funciona a 360 px e no desktop.
- [ ] Funciona no tema claro e no escuro.
- [ ] Tem estados de carregamento (esqueleto), vazio e erro.
- [ ] Passa no axe e no teste só com teclado.
- [ ] Regras de negócio com teste automático, incluindo casos-limite.
- [ ] Usa só tokens e componentes do Polar.
- [ ] Mudança de banco com migração versionada, RLS e índices.
- [ ] Commits pequenos, em português, em ramo separado.
