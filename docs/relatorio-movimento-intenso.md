# Relatório — Movimento intenso (`feat/movimento-intenso`)

## Diagnóstico (3 linhas)
1. **Fill-mode travava o hover:** `entrada` e `cascata` usavam `animation-fill-mode: both`, que deixa `transform: none` fixo depois da animação e anula o hover/toque dos cards em listas. Medido na main: `transform` do card em hover = `matrix(1,0,0,1,0,0)` (zero movimento).
2. **Tokens pequenos:** hover 1,012 com 2 px de subida, entrada de 4 px, cascata de 40 ms, pressionar 0,97, duração do contador 360 ms. Abaixo do que o olho percebe.
3. **Detecção de aparelho fraco agressiva, mas não era o vilão:** `hardwareConcurrency <= 4 || deviceMemory <= 2` pegava notebooks e celulares comuns. `prefers-reduced-motion` estava certo, porém zerava até o fade; os testes e2e e as capturas antigas rodavam com ele ligado.

## O que mudou
- **Tokens (`src/styles.css`)**, valores de "Normal": hover escala 1,025 + subida de 4 px + realce de 7 %; entrada de 14 px com escala 0,97; cascata de 60 ms; pressionar 0,95 (vai em 70 ms, volta com mola); anel, barra de meta e contador em 900 ms com a mesma curva; troca de tela e expansão mais longas e com deslocamento; linha interativa desliza 3 px. Curvas: `--ease-polar` e `--curva-enfase` tipo expo-out, `--mola` com passar do ponto de ~5 %.
- **Intensidade do movimento** (menu do usuário): Suave (≈ o movimento anterior), Normal (padrão), Expressivo. Atributo `data-intensidade` na raiz, aplicado antes da hidratação; guardada por aparelho (`localStorage`), sem mudança de banco.
- **Reduzir movimento do sistema:** vale sempre, em qualquer intensidade. Distâncias e escalas zeram e sobra só fade de 150 ms (entrada, cascata, troca de tela).
- **Aparelho fraco:** só até 2 núcleos ou 1 GB. Nele, sem escala e sem cascata, com durações curtas.
- Só `transform` e `opacity` (o desfoque do `subir` do login já existia).

## Verificação
| Item | Resultado |
|---|---|
| `tsc --noEmit` | sem erro |
| ESLint nos arquivos alterados | 0 erros (6 avisos antigos de fast-refresh) |
| Vitest | 118 passando |
| `vite build` | ok |
| axe (`acessibilidade.spec.ts`, 4 projetos) | 80/80; o `/auth` falhou por timeout na 1ª rodada (servidor frio) e passou nas 4 ao repetir |
| Orçamentos, CPU 4× mais lenta | INP 112 ms (< 200), CLS 0,005 (< 0,1), LCP 4,6 s (dev server) |
| Hover do card em `/links` | antes `matrix(1,0,0,1,0,0)`; depois `matrix(1.025,0,0,1.025,0,-4)` |
| Botão pressionado | antes escala 0,97; depois 0,95 |

Capturas em `docs/capturas/movimento-intenso/{antes,depois}` (hover do card e botão pressionado). Os quadros da entrada em cascata saíram vazios ou já terminados (os dados simulados chegam depois do primeiro quadro), então a entrada está comprovada pelos valores, não por imagem. Não gravei vídeo. Gerar de novo: `CAPTURA=antes|depois bun x playwright test capturas-movimento`.

## Limites
- A preferência é por aparelho; sincronizar entre aparelhos exigiria coluna em `usuarios` (pedir ao Lovable, como o tema).
- Só medi a rodada em Chrome desktop; falta olhar em celular real e em Safari (navegador sem `linear()` — Safari anterior ao 17.2 — descarta a transição com mola e o card muda sem animar).
