Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Gamificação: pontos só gravados por função no servidor.

## 1. Configurações de texto e pesos
- Tabela `configuracoes_texto`: `id`, `empresa_id`, `chave text`, `valor text`, `descricao`, `origem`, `created_at`, única em `(empresa_id, chave)`. Mesma RLS e auditoria de `configuracoes_regras` (ler com `tem_empresa`; escrever só diretoria). Crie a chave `hashtag_campanha` para as duas empresas com valor **vazio**: a diretoria cadastra a hashtag de cada campanha pela tela. Enquanto estiver vazia, só a menção `@centerfriosoficial` vale.
- Em `configuracoes_regras`, para as duas empresas: `peso_vendas` 30, `peso_cobertura` 20, `peso_reativacao` 20, `peso_orcamentos` 10, `peso_instagram` 5. **Valores iniciais a confirmar pela diretoria**; respeitam a regra do plano (venda vale mais que orçamento; cobertura e reativação valem mais que Instagram).

## 2. Pontos idempotentes
- `pontos`: índice único em `(empresa_id, vendedor_id, data, indicador)`.
- Função `calcular_pontos_dia(_empresa_id uuid, _vendedor_id uuid, _dia date)` (`security definer`). Permitida ao próprio vendedor, ao supervisor da equipe e à diretoria. Recalcula e grava (upsert) os pontos do dia por indicador, usando os dias úteis da tabela `feriados` (empresa nula ou igual) e America/Maceio:
  - `vendas`: ganha `peso_vendas` se o faturado do dia ≥ meta do dia, em que meta do dia = (meta do mês − faturado até o dia anterior) ÷ dias úteis restantes, contando o dia;
  - `orcamentos`: ganha `peso_orcamentos` se os orçamentos emitidos no dia ≥ (meta mensal − emitidos antes do dia) ÷ dias úteis restantes, arredondado para cima;
  - `cobertura`: ganha `peso_cobertura` se os clientes com interação qualificada no dia ≥ (meta % × carteira − cobertos até o dia anterior) ÷ dias úteis restantes, arredondado para cima;
  - `reativacao`: `peso_reativacao` por cliente que comprou no dia depois de `cliente_sem_compra_dias` ou mais sem comprar;
  - `instagram`: `peso_instagram` por post aprovado com `data_post` no dia.
  Com meta zero ou alvo zero, o indicador não pontua. Dia não útil não pontua (exceto reativação e Instagram). Devolve os pontos do dia por indicador.
- Tire de `authenticated` qualquer escrita em `pontos` e `selos` (já está assim; confira).

## 3. Selos e sequências
- `selos`: adicione `referencia text` (ex.: `2026-11` ou a data final da sequência) e índice único `(empresa_id, vendedor_id, nome, referencia)`.
- Função `atualizar_selos(_empresa_id, _vendedor_id, _dia date)` (`security definer`, mesmas permissões), que concede:
  - "Carteira 100%": cobertura de 100% no mês do dia (referência `AAAA-MM`);
  - "5 dias seguidos": meta de vendas do dia batida em 5 dias úteis seguidos terminando no dia (referência = data).
  Devolve os selos novos. ("Resposta relâmpago" fica para a Fase 2, com o WhatsApp.)

## 4. Ranking sem humilhação
Função `ranking(_empresa_id uuid, _inicio date, _fim date)` (`security definer`, `stable`), que soma os pontos no período. Visão por quem chama:
- vendedor: pódio (posições 1 a 3) mais a própria linha;
- supervisor: a equipe toda;
- diretoria: todos.

Cada linha traz `posicao`, `vendedor_id`, `nome`, `pontos` e `eh_voce`. Empate: mesma posição. A temporada é o mês (1º ao último dia) e o ranking da semana vai de segunda a domingo; o app passa as datas.

## 5. Posts do Instagram
- Tabela `posts_instagram`: `id`, `empresa_id`, `vendedor_id` (padrão `meu_usuario_id()`), `url text not null`, `legenda text not null`, `data_post date not null`, `status text not null default 'pendente'` (`pendente`, `aprovado`, `recusado`), `motivo_recusa text`, `validado_por uuid`, `validado_em timestamptz`, `origem`, `demo`, `created_at`.
- RLS: o vendedor insere e lê os próprios (inserção só com `status = 'pendente'`); supervisor e diretoria leem com carteira visível; ninguém altera pela API.
- Função `validar_post_instagram(_post_id uuid, _aprovar boolean, _motivo text)` (`security definer`), permitida ao supervisor da equipe do vendedor e à diretoria. Só aprova se a legenda citar `@centerfriosoficial` ou o valor de `hashtag_campanha` da empresa (sem diferenciar maiúsculas); se não citar, recusa com "A legenda precisa citar @centerfriosoficial ou a hashtag da campanha." Ao aprovar, chama `calcular_pontos_dia` do dia do post. Grava auditoria "validacao_instagram".

## Como conferir
1. Vendedor de teste que bateu a meta de vendas do dia: `calcular_pontos_dia` grava 30 em `vendas`; chamar de novo não duplica.
2. Vendedor tentando inserir em `pontos`: recusado.
3. `ranking` como vendedor devolve no máximo 4 linhas (pódio + a própria); como diretoria, todos.
4. Post com legenda sem a menção: aprovação recusada; com `@CenterfriosOficial`: aprovado, e entram 5 pontos em `instagram`. Com `hashtag_campanha` preenchida como teste, a hashtag também aprova.
5. Vendedor não consegue validar o próprio post.
Apague os dados de teste.
