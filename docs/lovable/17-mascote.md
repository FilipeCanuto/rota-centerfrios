Migração nova, sem editar migrações antigas e sem alterar telas em `src/`. Só dados de configuração para o mascote; nenhuma tabela nova.

## 1. Chaves novas em `configuracoes_regras`
Para **cada empresa** já cadastrada, inserir (sem sobrescrever se a chave já existir):

| chave | valor | para que serve |
| --- | --- | --- |
| `mascote_intervalo_baloes_s` | 20 | intervalo mínimo, em segundos, entre balões não urgentes |
| `mascote_ms_por_caractere` | 70 | tempo de balão na tela por caractere, em milissegundos |
| `mascote_permanencia_minima_s` | 5 | piso de tempo do balão na tela, em segundos |
| `mascote_incentivo_atingimento` | 0.7 | atingimento da meta (0 a 1) a partir do qual o mascote incentiva |

Se existir função ou gatilho que semeia as regras de uma empresa nova, acrescente as quatro chaves nele também.

## 2. Nada mais muda
- O mascote grava no sino pela função `registrar_notificacoes` que já existe (chave `mascote:<id>`, tipos já aceitos: `meta`, `recompra`, `orcamento_parado`, `esquecido`).
- Ele lê `preferencias_notificacao` (do próprio usuário) e `feriados`, com as políticas atuais.

## Como conferir
1. `select chave, valor from configuracoes_regras where chave like 'mascote_%'` devolve quatro linhas por empresa.
2. Sem as chaves, o app usa a reserva de `REGRAS_PADRAO` (mesmos valores), então nada quebra antes da migração.
