# Gestão da demonstração e carga de feriados

Aplicadas `0009_gestao_demonstracao_feriados` e `0010_corrigir_aliases_carga_demo`. A segunda corrige aliases ambíguos identificados no teste autenticado da carga; nenhuma migração anterior foi editada. Em `src/`, somente `integrations/supabase/types.ts` mudou, pela regeneração automática.

## Empresas e contagens reais

CENTERFRIOS e 381 Distribuidora estão com `demo = false`.

Primeira limpeza autenticada, incluindo dois cadastros temporários reais:

| Tabela | Reais antes | Reais depois |
|---|---:|---:|
| clientes | 0 | 0 |
| vendas | 0 | 0 |
| interacoes | 0 | 0 |
| metas | 0 | 0 |
| configuracoes_regras | 14 | 14 |
| empresas | 2 | 2 |
| feriados | 20 | 20 |
| usuarios | 2 | 4 |

A diferença em usuários é obrigatória: Humberto e Clara tinham login, mas eram `demo = true`; ambos foram preservados e convertidos para `demo = false`. Portanto a contagem de usuários reais aumenta em dois, em vez de permanecer igual. Repetindo a limpeza, todas as contagens reais permaneceram iguais. Após remover as duas contas temporárias, restam os dois usuários reais originais.

Resumo devolvido na primeira limpeza e gravado pela função interna de auditoria:

```json
{"interacoes":282,"vendas":937,"orcamentos":90,"tarefas_agenda":2,"alertas":0,"pontos":4,"selos":2,"metas":48,"links":3,"clientes":60,"equipes":1,"usuario_empresas":2,"papeis_pre_cadastro":1,"usuarios":1}
```

Após essa chamada, nenhuma tabela com coluna `demo` continha linhas demo. Configurações e feriados não têm essa coluna e não foram alterados pela limpeza.

## Verificações autenticadas

`python3 tests/test_gestao_demo.py`: **8 testes passaram**, usando login real por senha em contas temporárias pré-cadastradas, não `service_role` para executar as funções.

| Cenário | Resultado |
|---|---|
| Empresas reais | Ambas `demo = false` |
| Limpeza como administrador | Resumo recebido, dados reais preservados, zero demo após limpeza |
| Contas existentes | Mesmo login, papéis e vínculos nas duas empresas |
| Recriação nos ids de Humberto e Clara | 60 clientes, cidades de Alagoas, todos os telefones com DDD 82 |
| Apenas duas compras | Exatamente 2 clientes |
| Nunca compraram | Exatamente 2 clientes, sem vendas e sem última compra |
| Compra ontem sem interação | 1 cliente, nenhuma interação histórica ou recente |
| Último contato na sexta | Orçamento aberto com `ultimo_followup` na sexta anterior |
| Interação qualificada noturna | Dia anterior às 23h30 em America/Maceio |
| Metas | 4 metas do mês atual, uma por vendedor/empresa |
| Segunda carga demo | Recusada: “Já existem dados de demonstração.” |
| Feriados | Função devolveu 0; tabela permanece com 20 |
| Vendedor nas três funções | Todas recusadas, código 42501 |
| Auditoria | Resumo igual ao devolvido, ator correto; 5 registros de limpeza ao final |
| Carga sem vendedores | Humberto Demo, Clara Demo, Supervisor Demo sem login; equipe demo |
| Limpeza dos fictícios | Removeu 3 usuários, 1 equipe, 6 vínculos e 3 papéis pendentes |
| Final | Demonstração recriada nas contas reais; nenhum usuário temporário restante |

Estado final: 60 clientes demo, 676 vendas demo, 59 interações demo, 20 feriados e 14 configurações reais. Humberto mantém vendedor + administrador; Clara mantém vendedor. Nenhum papel foi acrescentado a essas contas.

As relações de auditoria com vendedores removidos ficam nulas, preservando o histórico e os ids antigos em detalhes. A limpeza cancela atomicamente se detectar registros reais dependentes de clientes/vendedores fictícios, evitando exclusões reais em cascata. Vendedores existentes devem ter vínculo com ambas as empresas antes da carga; ela não concede acessos automaticamente. Metas reais existentes nunca são sobrescritas.

## Produção

Conforme comentário em 0009, bancos novos continuam recebendo a demonstração histórica de 0001/0002. Antes do primeiro uso real, uma conta autenticada de administrador ou diretoria executa:

```sql
select public.apagar_dados_demo();
select public.carregar_feriados_nacionais();
```

As 20 datas e nomes nacionais de 2026/2027 estão no corpo da função versionada, com conflito ignorado. A carga não depende dos registros deste ambiente.

16 testes puros existentes passaram; última verificação automática: `build OK`. Nenhuma tela foi modificada.