# Rota CENTERFRIOS — guia para quem programa

Plataforma interna de carteira, agenda e metas das vendedoras e vendedores da CENTERFRIOS e da 381 Distribuidora. As regras de arquitetura, banco e Lovable estão em [AGENTS.md](AGENTS.md); leia-o antes de mexer em banco, permissões ou integrações. O estado do trabalho está em [docs/progresso.md](docs/progresso.md) e o que falta para o primeiro uso real em [docs/lancamento.md](docs/lancamento.md).

## Comandos
- Testes de regras: `bun x vitest run` (ou `node node_modules/vitest/vitest.mjs run` sem o bun).
- Tipos e lint: `bun x tsc --noEmit` e `bun x eslint .`.
- Ponta a ponta + axe: `bun x playwright test` (Chrome instalado, backend simulado em `e2e/simulacao.ts`; nenhuma credencial real nem rede).
- Rotas são geradas (`src/routeTree.gen.ts`): rodar `vite build` ou `vite dev` depois de criar uma rota. Não edite o arquivo gerado.

## Estrutura
- `src/design-system`: tokens e componentes (SeloStatus, GraficoAnel, Pinguim…).
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
- Dado de cliente não vai para endereço (URL), log nem serviço externo.
- Não reescreva histórico já publicado no git (projeto ligado ao Lovable).
