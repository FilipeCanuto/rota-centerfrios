# Rota CENTERFRIOS — relatório de ajustes

Atualizado em 11/11/2026 · Ramo de trabalho: `revisao-fundacao` (igual ao `main` @ `6c52288`, mais os documentos desta revisão)

## Resumo
- A fundação foi revisada e o relatório completo está em [`revisao-fundacao.md`](revisao-fundacao.md): 9 problemas críticos, 11 altos, 10 médios e 4 baixos.
- **Todos os problemas de banco de dados já foram corrigidos no Lovable**, em 9 migrações novas (`0003` a `0011`), cada uma conferida com testes automáticos de acesso real.
- **O código do app (telas e regras) ainda não mudou.** Essa é a Etapa C, que começa pelas regras de negócio.
- O símbolo da nova marca foi aprovado e fica guardado até a escolha do nome.
- Custo no Lovable: cerca de 25 créditos.

## 1. O que foi corrigido no banco (Lovable)

| # | Migração | O que mudou | Problema resolvido |
| --- | --- | --- | --- |
| 1 | `0003` | Cadastro só por convite. Só entram e-mails `@centerfrios.com` e `@grupo381.com.br`, e só quem foi pré-cadastrado. Acabaram o "primeiro usuário vira administrador" e o vínculo automático com os vendedores de demonstração | C1 |
| 2 | `0004` | Novas permissões: o vendedor lê só a própria carteira e **não altera** vendas, metas, pontos nem selos. O administrador deixa de ver dados comerciais. Papéis podem valer por empresa. O usuário só altera o próprio apelido e tema | C2, C3, A1, A3 |
| 3 | `0005` | Troca de carteira só pela função `remanejar_cliente`: pelo supervisor da equipe, com 90 dias sem compra (lidos da configuração) e com motivo. A auditoria não pode mais ser escrita por usuários e registra metas, regras, papéis, vínculos e trocas de carteira | C4, A2 |
| 4 | `0006` | Tabela `feriados`, editável só pela diretoria e auditada, com os 20 feriados nacionais de 2026 e 2027. Novembro/2026 = 19 dias úteis. Feriados de Alagoas e de Maceió ficam para a diretoria cadastrar pela lista da contabilidade | C5 (banco) |
| 5 | `0007` | Índices nas colunas de filtro (empresa, vendedor, cliente, datas) e políticas de acesso otimizadas | A4 |
| 6 | `0008` | Funções `painel_vendedor` e `cobertura_vendedor`: o banco devolve os números já somados, sem o corte de 1.000 linhas e com datas no fuso de Maceió | C8 (banco), A5 (banco) |
| 7 | `0009`, `0010` | As empresas passam a ser reais (não demonstração). Funções para apagar e recriar a demonstração (cidades de Alagoas, DDD 82, casos-limite) e para carregar os feriados num banco novo | C9, M10 |
| 8 | `0011` | Correção encontrada na conferência: o administrador não pode mais religar logins nem mexer em campos internos de usuário. O e-mail de quem já tem login fica travado, e toda alteração é auditada | Nova (achada na Etapa B) |

**Situação atual do banco**, conferida em 11/11/2026:
- CENTERFRIOS e 381 Distribuidora estão marcadas como reais.
- 60 clientes de demonstração, em cidades de Alagoas.
- 20 feriados nacionais.
- `filipecanuto@centerfrios.com` (Humberto) com os papéis vendedor + administrador; `adm@centerfrios.com` (Clara) com vendedor.
- O Lovable criou testes de integração em `tests/` e registrou o resultado de cada etapa em `docs/verificacao-*.md`.

## 2. Decisões tomadas
1. Migrações: o Claude Code não escreve SQL de migração. Toda mudança de banco passa pelo Lovable.
2. Meta diária de cobertura = (meta mensal de cobertura − cobertura atingida) ÷ dias úteis restantes. Falta registrar em `docs/estrategia.md` (Etapa C).
3. Cantos: 12 px nos cartões e 8 px nos botões.
4. Marca e login novos: não aplicar agora. Do passo 5, só "Esqueci minha senha" (A8) e os textos do convite (C1).
5. Login com Google: só `@centerfrios.com` e `@grupo381.com.br`. **Já aplicado no banco.**
6. Feriados: só os nacionais na carga; estaduais e municipais pela lista oficial da contabilidade.

## 3. Marca (proposta aprovada, ainda não aplicada)
O pinguim do logo oficial foi redesenhado em vetor, de pé sobre uma "rota" que termina num ponto ouro (a meta atingida). Arquivos em [`proposta/`](proposta/), com a [apresentação](proposta/apresentacao.png): ícone do app, assinaturas para fundo claro e escuro e favicon. O símbolo foi aprovado em 10/11/2026 e entra no app quando o nome for escolhido.

## 4. Pendências

| Pendência | O que falta | Quem |
| --- | --- | --- |
| Entrada em produção | Antes do primeiro uso real, rodar `apagar_dados_demo()` e depois `carregar_feriados_nacionais()`. As migrações antigas ainda criam demonstração num banco novo | Administrador, no lançamento |
| Colunas antigas `usuarios.perfil` e `empresas.empresa_id` | Estão só marcadas como obsoletas. Para removê-las, liberar "Execute backward incompatible database migrations" em Settings → Agent permissions do Lovable e pedir uma migração | Você + Lovable |
| `.gitignore` | Acrescentar `__pycache__/` e `*.pyc` (o Lovable não pode editar esse arquivo). Os caches já saíram do repositório | Claude Code, na Etapa C |
| Login Google com conta Gmail | O bloqueio existe no banco, mas não foi testado com um login Google real | Teste manual |
| Uso dos índices | A API não devolveu o plano das consultas. Medir quando houver dados reais do Shop9 | Depois da integração |
| Feriados de Alagoas e de Maceió | Cadastrar pela lista oficial da contabilidade | Diretoria |

## 5. Próximo passo: Etapa C (no ramo `revisao-fundacao`, um PR por passo)
1. **Regras de negócio (passo 2):** dias úteis com a tabela de feriados (corrigindo o teste para 19), compra contando como interação qualificada, regras por empresa, fuso de Maceió, regras do painel saindo da tela para `src/regras` com testes e uso das funções `painel_vendedor` e `cobertura_vendedor`. Inclui a atualização da regra de cobertura diária em `docs/estrategia.md`. No fim, rodar os testes e mostrar o resultado.
2. **Arquitetura (passo 3):** interfaces de Instagram e voz, acesso ao banco em hooks, busca por empresa, estados de erro.
3. **Polar e acessibilidade (passo 4):** lint e testes automáticos de acessibilidade (axe), tokens em três camadas, ajustes da página do design system e do selo de cobertura no celular.
4. **Login (passo 5, parcial):** "Esqueci minha senha", "Mostrar senha" e o texto "Primeiro acesso? Peça seu convite".
5. **PWA (passo 6)** e **acabamento (passo 7)**.
6. **No fim:** o `CLAUDE.md` na raiz, já com as decisões acima.
