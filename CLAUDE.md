# Rota CENTERFRIOS — guia para quem programa

Plataforma interna de carteira, agenda e metas das vendedoras e vendedores da CENTERFRIOS e da 381 Distribuidora. As regras de arquitetura, banco e Lovable estão em [AGENTS.md](AGENTS.md); leia-o antes de mexer em banco, permissões ou integrações. O estado do trabalho está em [docs/progresso.md](docs/progresso.md) e o que falta para o primeiro uso real em [docs/lancamento.md](docs/lancamento.md).

## Comandos
- Testes de regras: `bun x vitest run` (ou `node node_modules/vitest/vitest.mjs run` sem o bun).
- Tipos e lint: `bun x tsc --noEmit` e `bun x eslint .`.
- Ponta a ponta + axe: `bun x playwright test` (Chrome instalado, backend simulado em `e2e/simulacao.ts`; nenhuma credencial real nem rede).
- Rotas são geradas (`src/routeTree.gen.ts`): rodar `vite build` ou `vite dev` depois de criar uma rota. Não edite o arquivo gerado.

## Estrutura
- `src/design-system`: tokens e componentes (SeloStatus, GraficoAnel, Mascote…).
- `src/modulos/<módulo>`: telas e hooks de dados (`dados.ts`). Um módulo por assunto: agenda, clientes, orcamentos, links, gamificacao, copiloto, gestao, notificacoes, configuracoes.
- `src/regras`: regras puras (sem rede), testadas em `*.test.ts`. Toda conta de negócio nova vai aqui, com teste.
- `src/integracoes`: interfaces e implementações "manual"; trocar uma integração não mexe nas telas.
- `drizzle/migrations`: só o Lovable altera. Pedir mudança de banco pelas mensagens em `docs/lovable/`.

## Definição de pronto de uma tela
1. Limites de negócio vêm de `configuracoes_regras` (nunca fixos na tela).
2. Status sempre com ícone e palavra (`SeloStatus`); gráfico com resumo em texto e "Ver como tabela".
3. Estados de carregando, erro (`EstadoErro`) e vazio (`EstadoVazio`).
4. Alvos de toque de 44 px, rótulos em todos os campos, foco visível, um só `h1`, sem rolagem lateral a 320 px.
5. Entrada na lista de rotas de `e2e/acessibilidade.spec.ts` (axe nos dois temas, celular e desktop) e dados simulados em `e2e/simulacao.ts`.
6. `tsc`, `eslint` e `vitest` sem erro; `docs/progresso.md` atualizado.

## Cuidados
- Pontos e selos só são gravados por funções do banco; o app nunca escreve em `pontos` ou `selos`.
- O vendedor só altera colunas liberadas por permissão de coluna (ex.: orçamentos: `ultimo_followup`, `proximo_followup`, `observacao`).
- Avisos e mídia do login: "Pode publicar avisos" (`usuarios.pode_publicar_avisos`, padrão desligada) só o administrador altera, pela função `admin_atualizar_usuario`; a checagem é do banco (`pode_publicar_avisos()`), a tela só esconde botões. Mídia do login é só do administrador. Arquivos: JPG, PNG, WebP, AVIF, GIF, MP4, WebM; 5 MB imagem/GIF e 25 MB vídeo (`src/regras/midia.ts`, repetido no servidor). Texto alternativo é obrigatório.
- Setores: acesso = papel **e** setor. Registro em `src/modulos/setores/setores.ts`, guarda única no `beforeLoad` de `src/routes/_authenticated/route.tsx`, seletor em `/setores`; no banco, `tem_setor()` em políticas RESTRICTIVE. Tela nova de um setor entra nos prefixos `rotas` do setor. Setor novo em 3 passos: [docs/setores.md](docs/setores.md).
- Carrinho e orçamento da Rota: só funções do banco gravam (`abrir_carrinho`, `adicionar/alterar/remover_item_carrinho`, `concluir_carrinho`, `cancelar_carrinho`); totais, limite de carrinhos abertos (`carrinho_max_abertos`) e desconto (`validar_desconto`) são do servidor. As regras espelho estão em `src/regras/carrinho.ts`. Dinheiro em centavos, arredondamento por item.
- Shop9: envio de orçamentos por `integracoes.envioShop9` (hoje manual em CSV; `shop9Api.ts` desligado). Credenciais só nos Secrets do servidor. O que falta da Idealsoft: [docs/shop9-mapeamento.md](docs/shop9-mapeamento.md).
- Contas com `usuarios.acesso_total` têm todos os setores: política de setor usa sempre `tem_setor()`, nunca a lista de setores.
- Dado de cliente não vai para endereço (URL), log nem serviço externo.
- Mascote: as telas só emitem eventos por `useMascote()` (`notificar`, `definirEstado`) e nunca importam o desenho. Contrato e como adicionar estado, mensagem e evento em [docs/mascote.md](docs/mascote.md).
- Papéis, vínculos de empresa e pré-cadastro só mudam pelas funções `admin_*` (texto 23); ninguém se dá papel novo, só quem tem `acesso_total`.
- "Orçamento parado": um critério só, `ultimaAtividadeOrcamento` em `src/regras/carteira.ts` (último retorno ou data do orçamento, ou o último contato com o cliente). Início, Gestão e Orçamentos usam a mesma conta.
- Rede e sessão: a guarda de rota usa a sessão local (`getSession`); o padrão das consultas fica no `QueryClient` de `src/router.tsx` (30 s de validade, erro com código do banco não é repetido).
- WhatsApp (Evolution), e-mail e Instagram: contrato em `src/integracoes/tipos.ts` (`CanalConversa`), modo simulado e lista do que falta em `src/integracoes/conexoes.ts`. Segredos só nos Secrets do servidor; a tela mostra só o nome deles.
- Meta por venda faturada: venda com vendedor 2 vira uma linha de `vendas` por vendedor com 50% cada, no mesmo formato do conector (`shop9_ordem` agrupa a nota); devolução entra negativa (`shop9_tipo = 'devolucao'`) e não conta como compra; nota cancelada sai; depois de bater a meta, a meta do dia é a média diária do mês. Carrinho sempre com o preço de tabela do dia. O vendedor 2 vê as vendas dele em `/vendas-compartilhadas` (função `minhas_vendas_compartilhadas`), sem abrir a ficha do cliente.
- Auditoria geral e decisões: [docs/auditoria-fable.md](docs/auditoria-fable.md).
- Não reescreva histórico já publicado no git (projeto ligado ao Lovable).

## Banco e Lovable
- **Fluxo (desde 17/11/2026):** o Claude Code escreve o texto de banco e abre o PR; **o usuário aplica o SQL no banco e faz o merge**. O Claude Code não aplica SQL no banco, não faz merge e não pede ao agente do Lovable (gasta crédito).
- **Ordem:** quando o código do PR depende do banco, o SQL é aplicado antes do merge. O PR diz no topo: "Banco: aplicar o texto NN antes do merge" (ou "Sem banco").
- **Numeração:** antes de criar `docs/lovable/NN-*.md`, conferir os PRs abertos (`gh api repos/FilipeCanuto/rota-centerfrios/pulls?state=open`) e as migrações do `main`; dois PRs nunca usam o mesmo NN, e o texto diz qual texto anterior precisa estar aplicado.
- O Lovable fica só para publicar e para o que só ele faz. Nunca pedir a ele perguntas, conferências ou mudanças de tela.
- Todo texto de banco (`docs/lovable/NN-*.md`) tem, nesta ordem:
  1. a instrução: "Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.";
  2. o SQL final completo, pronto para executar;
  3. testes em SQL puro dentro de `BEGIN ... ROLLBACK` (usuários simulados com `set local role authenticated` e `request.jwt.claims`), com asserções que levantam erro se falharem, sem deixar dados.
- Juntar as mudanças de banco num único texto sempre que possível.
- Ao entregar, dizer "ENVIEI" ou "PRONTO PARA COLAR", nunca os dois.
