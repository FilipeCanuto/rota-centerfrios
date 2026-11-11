Agora a tabela de feriados, usada para contar os dias úteis. Faça numa **migração nova**, sem editar migrações antigas e **sem alterar telas em `src/`** (só regenere `src/integrations/supabase/types.ts`).

## 1. Tabela `public.feriados`
Colunas:
- `id uuid` (chave, gerada);
- `empresa_id uuid` nula = vale para as duas empresas (referência a `empresas.id`);
- `data date not null`;
- `nome text not null`;
- `abrangencia text not null`, com os valores `nacional`, `estadual` ou `municipal`;
- `localidade text`, nula para nacionais (ex.: "AL" ou "Maceió");
- `origem origem_dado not null default 'manual'`;
- `created_at timestamptz not null default now()`.

Regras:
- Restrição única em `(empresa_id, data)`, tratando nulo como igual (`nulls not distinct`).
- Índice em `data`.
- RLS ligada. Ler: qualquer usuário autenticado (`empresa_id` nulo ou `tem_empresa(empresa_id)`). Inserir, alterar e apagar: só `diretoria`.
- Gatilho de auditoria ("alteracao_feriado"), usando a função `auditar` da mensagem 03.

## 2. Carga inicial: só os feriados nacionais de 2026 e 2027
Insira exatamente estas datas, com `empresa_id` nulo, `abrangencia = 'nacional'` e `origem = 'manual'`. **Não inclua** feriados estaduais, municipais nem pontos facultativos (Carnaval, Corpus Christi, Quarta-feira de Cinzas): a diretoria vai cadastrar esses a partir da lista oficial da contabilidade.

| Data | Nome |
| --- | --- |
| 2026-01-01 | Confraternização Universal |
| 2026-04-03 | Paixão de Cristo |
| 2026-04-21 | Tiradentes |
| 2026-05-01 | Dia do Trabalho |
| 2026-09-07 | Independência do Brasil |
| 2026-10-12 | Nossa Senhora Aparecida |
| 2026-11-02 | Finados |
| 2026-11-15 | Proclamação da República |
| 2026-11-20 | Dia Nacional de Zumbi e da Consciência Negra |
| 2026-12-25 | Natal |
| 2027-01-01 | Confraternização Universal |
| 2027-03-26 | Paixão de Cristo |
| 2027-04-21 | Tiradentes |
| 2027-05-01 | Dia do Trabalho |
| 2027-09-07 | Independência do Brasil |
| 2027-10-12 | Nossa Senhora Aparecida |
| 2027-11-02 | Finados |
| 2027-11-15 | Proclamação da República |
| 2027-11-20 | Dia Nacional de Zumbi e da Consciência Negra |
| 2027-12-25 | Natal |

## Como conferir
1. `select count(*) from feriados` → 20.
2. Contando de segunda a sexta em novembro de 2026 e descontando as datas da tabela, o resultado é **19 dias úteis** (02/11 e 20/11 caem em dia de semana; 15/11 é domingo).
3. Um vendedor de teste consegue ler a tabela, mas não inserir; a diretoria consegue inserir um feriado municipal de teste, e aparece "alteracao_feriado" em `registro_auditoria`. Apague o feriado de teste.
