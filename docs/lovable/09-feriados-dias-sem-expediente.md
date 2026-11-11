Agora preciso que os feriados fiquem fáceis de editar pela diretoria. Faça numa **migração nova**, sem editar migrações antigas e **sem alterar telas em `src/`**. A tela será feita no ramo `revisao-fundacao`; **mantenha** a regeneração de `src/integrations/supabase/types.ts`.

## 1. Nova abrangência "empresa"
- Troque a restrição `feriados_abrangencia_valida` para aceitar `nacional`, `estadual`, `municipal` e **`empresa`** (dia sem expediente definido pela diretoria, como Carnaval e Corpus Christi).
- Todas as abrangências contam como dia não útil; o app trata todas do mesmo jeito.
- `empresa_id` continua opcional em qualquer abrangência: nulo vale para as duas empresas; preenchido vale só para aquela empresa.

## 2. Datas móveis
- Adicione a coluna `data_movel boolean not null default false`. Ela marca as datas que mudam de dia a cada ano (Paixão de Cristo, Carnaval, Corpus Christi). A tela usa isso para o botão "Copiar para o próximo ano", que só copia as datas fixas.
- Marque `data_movel = true` nos dois registros "Paixão de Cristo" já cadastrados (2026-04-03 e 2027-03-26), pela ferramenta de dados.
- Atualize `carregar_feriados_nacionais()` para gravar `data_movel = true` na Paixão de Cristo.

## 3. Copiar para o próximo ano
Crie a função `public.copiar_feriados_para_ano(_ano_origem int, _ano_destino int)` (`security invoker`, executável por `authenticated`; a RLS já exige diretoria para inserir). Ela:
- copia todos os feriados de `_ano_origem` com `data_movel = false` para o mesmo dia e mês em `_ano_destino`, mantendo nome, abrangência, localidade e empresa;
- ignora 29/02 quando o ano de destino não for bissexto;
- não duplica: usa `on conflict (empresa_id, data) do nothing`;
- devolve `jsonb` com `{ copiados, ja_existiam, ignorados_moveis }`.

## Como conferir
1. A diretoria insere um dia "Carnaval" com abrangência `empresa`, `data_movel = true` e `empresa_id` nulo: funciona e aparece "alteracao_feriado" na auditoria.
2. Um vendedor não consegue inserir com abrangência `empresa`.
3. `copiar_feriados_para_ano(2027, 2028)` como diretoria copia as datas fixas de 2027 (9 nacionais), não copia a Paixão de Cristo nem o Carnaval de teste, e uma segunda chamada devolve `copiados = 0`.
4. Um vendedor chamando `copiar_feriados_para_ano` não consegue inserir nada.
5. Apague o Carnaval de teste e os feriados de 2028 criados no teste.
