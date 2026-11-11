Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Últimas peças de banco da Fase 1.

## 1. Painel da gestão
Função `painel_gestao(_empresa_id uuid, _hoje date)` (`security invoker`, `stable`, America/Maceio), uma linha por vendedor visível ao chamador, com o papel `vendedor` na empresa ou com carteira nela. A RLS faz o supervisor ver só a equipe e a diretoria ver todos. Devolve `jsonb` (lista), com, por vendedor:
- `vendedor_id`, `nome`, `equipe`;
- `meta` (linha do mês ou nulo), `faturado_mes`, `faturado_hoje`;
- `clientes_total`, `clientes_cobertos` (compra ou interação qualificada no mês);
- `orcamentos_abertos`: lista `{id, cliente_id, valor, data, ultimo_followup, ultima_interacao}` (dia local);
- `clientes_sem_compra_90`: quantidade de clientes com `data_ultima_compra` nula ou com pelo menos `cliente_sem_compra_dias` dias;
- `esquecidos`: quantidade sem interação qualificada nem compra há pelo menos `cliente_esquecido_dias` dias.

A visão somada das empresas é feita pelo app, chamando uma vez por empresa.

## 2. Copiloto
Em `usuarios`, adicione `pinguim_versao text not null default 'consultor'` (`consultor`, `panificador`, `acougueiro`, `pizzaiolo`) e `copiloto_minimizado boolean not null default false`. O próprio usuário pode alterar essas duas colunas e `apelido_copiloto` (some às permissões por coluna que já existem).

## 3. Notificações internas
- Tabela `notificacoes`: `id`, `usuario_id` (→ usuarios), `empresa_id` (pode ser nulo), `tipo text` (`recompra`, `orcamento_parado`, `esquecido`, `tarefa`, `meta`, `selo`, `instagram`, `sistema`), `titulo text`, `corpo text`, `link text`, `lida_em timestamptz`, `chave text` (para não duplicar), `created_at`. Índice único `(usuario_id, chave)` e índice `(usuario_id, created_at desc)`. RLS: cada um lê e marca como lida (só a coluna `lida_em`) as próprias; inserção só pela função abaixo.
- Tabela `preferencias_notificacao`: `usuario_id` (chave), `tipos_desligados text[] not null default '{}'`, `expediente_inicio time not null default '08:00'`, `expediente_fim time not null default '18:00'`, `sabado_inicio time` (padrão `'08:00'`, nulo = sem expediente no sábado), `sabado_fim time` (padrão `'12:00'`), `created_at`. Padrão aprovado pela diretoria: segunda a sexta das 8h às 18h e sábado das 8h às 12h; fora disso, aos domingos e nos feriados da tabela `feriados` as notificações ficam em silêncio. Cada pessoa pode ajustar o próprio horário. RLS: cada um lê e grava a própria.
- Função `registrar_notificacoes(_itens jsonb)` (`security definer`): para o próprio usuário (`meu_usuario_id()`), insere a lista `{tipo, titulo, corpo, link, chave, empresa_id}`, ignorando chaves repetidas e tipos desligados nas preferências. Devolve quantas inseriu. (O silêncio fora do expediente, aos domingos e nos feriados é aplicado pelo app na hora de exibir o aviso; a notificação continua registrada.)
- Inclua `notificacoes` em `apagar_dados_demo()` quando o usuário for fictício.

## 4. Demonstração completa
- `apagar_dados_demo()` passa a incluir todas as tabelas novas com `demo` (`itens_venda`, `notas_cliente`, `posts_instagram`) e as notificações de usuários fictícios.
- `carregar_dados_demo()` passa a criar também:
  - de 1 a 3 itens por venda (produtos como "Câmara fria 2x2", "Balcão refrigerado 2 m", "Freezer horizontal 500 L", "Forno turbo", "Expositor de bebidas");
  - etiquetas em alguns clientes ("Rede", "Inauguração", "Inadimplente");
  - uma nota em 10 clientes;
  - 3 orçamentos com `proximo_followup`;
  - 2 posts do Instagram pendentes.
- Depois de aplicar, rode `apagar_dados_demo()` e `carregar_dados_demo()` (sem parâmetro) para recriar a demonstração com tudo.

## Como conferir
1. `painel_gestao` como diretoria: os 3 vendedores de demonstração; como vendedor de teste: só a própria linha.
2. Usuário altera `pinguim_versao` e `copiloto_minimizado` próprios; não altera os de outro.
3. `registrar_notificacoes` com chave repetida não duplica; com tipo desligado não insere; ninguém lê notificação de outro.
Apague os dados de teste.
