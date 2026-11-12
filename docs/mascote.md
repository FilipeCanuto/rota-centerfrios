# Mascote — contrato

O mascote flutua em todas as telas logadas, reage ao que acontece e fala em balões. **As telas e as regras nunca importam o desenho**: só emitem eventos pela API abaixo. Função nova no sistema não exige mexer no mascote.

## API (a única porta de entrada)

```ts
import { useMascote } from "@/modulos/mascote/MascoteProvider";
import { mensagem } from "@/modulos/mascote/mensagens";

const mascote = useMascote();
mascote.notificar(mensagem("orcamento_parado", `orcamentos-parados:${dia}`, apelido, 3));
mascote.definirEstado("pensando"); // reação sem fala, por alguns segundos
```

- `notificar({ id, tipo, prioridade, texto, estado?, acao?, expiraEm? })` — o `id` evita repetição (use algo estável, como `assunto:data`). Tudo que é falado **também vai para o sino** (`registrar_notificacoes`, chave `mascote:<id>`).
- `definirEstado(estado, duracaoMs?)` — estado desconhecido vira `neutro`.
- Fora do provider (login, testes) as duas funções não fazem nada: emitir um evento nunca quebra a tela.

## Como adicionar (3 passos cada)

**Estado novo**

1. Uma linha em `ESTADOS_MASCOTE` (`src/regras/mascote.ts`): rótulo e som (`conquista`, `alerta`, `erro` ou `null`).
2. Um bloco `.mascote[data-estado="nome"]` em `src/styles.css`, só ajustando as variáveis `--m-*` (boca, sobrancelhas, olhar, asas, extras).
3. Conferir na vitrine `/design-system` (lista todos os estados sozinha).

**Mensagem nova**

1. Uma entrada em `MENSAGENS` (`src/modulos/mascote/mensagens.ts`): tipo, prioridade, estado, texto com o apelido (até ~90 caracteres) e, se fizer sentido, `acao`.
2. Se depender de um limite, crie a chave em `configuracoes_regras` (reserva em `REGRAS_PADRAO`, pedido ao Lovable em `docs/lovable/`).
3. Chamar `mascote.notificar(mensagem("chave", id, apelido, n))` onde o dado nasce.

**Evento novo**

1. Se o banco já grava uma notificação para ele: acrescente o tipo em `REACAO_POR_TIPO` e pronto, o mascote fala sozinho quando ela chegar.
2. Se nasce na tela: `useMascote().notificar(...)` ou `definirEstado(...)` no ponto em que acontece.
3. Um teste do que foi emitido (a fila e os estados já têm teste em `src/regras/mascote.test.ts`).

Reações que já vêm de graça: erro em qualquer consulta ou gravação (estado `erro`), gravação em andamento e consultas com chave `["ia", …]` (estado `pensando`), fora do expediente (estado `descanso`).

## Regras de quando falar

- Fila por prioridade: urgente > importante > informativo. Urgente fura o limite de frequência e troca o balão que está na tela.
- Limites vêm de `configuracoes_regras`: `mascote_intervalo_baloes_s`, `mascote_ms_por_caractere`, `mascote_permanencia_minima_s`, `mascote_incentivo_atingimento`.
- Silêncio: respeita `preferencias_notificacao` (tipos desligados e horário de trabalho), domingos e feriados. Fora do expediente só o urgente abre balão; o resto fica no sino.
- Preferências do aparelho (canto, minimizado, balões ocultos, som mudo) ficam no `localStorage`, por usuário.

## Peças

| Arquivo                               | Papel                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/design-system/MascoteSprite.tsx` | A arte: um `<symbol>` com grupos nomeados (`m-cabeca`, `m-olhos`, `m-bico`, `m-asa-esq`…). Montado uma vez na raiz.                                                             |
| `src/design-system/Mascote.tsx`       | `<Mascote estado tamanho />`: só desenha (40, 64, 120, 160 px).                                                                                                                 |
| `src/styles.css`                      | Tokens `--mascote-*` (claro e escuro), estados e movimento (só `transform`/`opacity`).                                                                                          |
| `src/regras/mascote.ts`               | Regras puras: estados, fila, expediente, cantos.                                                                                                                                |
| `src/modulos/mascote/`                | `MascoteProvider` (API, fila, sino, error boundary), `MascoteFlutuante` (arrastar, menu, balão), `mensagens.ts`, `som.ts` (efeitos WebAudio; voz atrás de `VOZ_ATIVA = false`). |

`src/design-system/mascote/` e `scripts/gerar-mascote.ts` são o gerador antigo dos SVG de `public/mascote/` (material de divulgação); o sistema não usa mais.
