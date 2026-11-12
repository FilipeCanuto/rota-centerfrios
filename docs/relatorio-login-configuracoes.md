# Relatório — Login em duas colunas e Configurações (`feat/login-configuracoes`)

## O que mudou
**Login (`/auth`)**
- Desktop (≥ 1024 px): palco de mídia à esquerda (~58%, altura total, cantos arredondados) e formulário à direita sobre uma malha de luz lenta (gradientes radiais do Polar; só `transform`/`opacity`; para com a aba oculta e fica estática com `prefers-reduced-motion`).
- Tablet: palco como faixa alta (256 px) sobre o formulário. Celular: faixa de 144 px no topo; some abaixo de 340 px.
- No DOM o formulário vem primeiro (a tabulação e o leitor de tela começam nele); o palco só é buscado depois do primeiro desenho (`lazy` + consulta adiada), então não desloca o layout.
- Palco (`src/modulos/login/PalcoMidia.tsx`): imagem, GIF e vídeo (mudo, loop, `playsinline`); troca a cada 12 s com crossfade e zoom lento nas imagens; pontos indicadores e botão Pausar/Retomar. Com movimento reduzido começa pausado; vídeo não toca sozinho em movimento reduzido ou economia de dados (mostra o primeiro quadro, que faz papel de poster). Sem mídia ativa: fundo animado da marca com o logo, nunca vazio.
- Mantidos: e-mail e senha, "Primeiro acesso ou esqueci a senha", reenvio de confirmação, mascote. **Sem botão do Google** (decisão do usuário).

**Configurações (`/configuracoes?aba=…`, só administrador)**
- Abas registradas em `src/modulos/configuracoes/abas.tsx`: para criar "Avisos" basta o componente e uma linha na lista (rota, aba e axe já valem). Atalho "Configurações" em Mais, só para administrador.
- Aba **Mídia do login**: envio com validação de formato e peso (JPG, PNG, WebP, AVIF, GIF, MP4, WebM; 5 MB imagem/GIF, 25 MB vídeo), texto alternativo obrigatório, ordenar por arrastar ou botões subir/descer (teclado), ativar/desativar, excluir com confirmação, proporção recomendada (16:10 ou 16:9), dicas de peso e prévia que usa o mesmo componente do login.
- Regra pura nova com teste: `moverItem` (`src/regras/midia.ts`).

## Verificação
| Item | Resultado |
|---|---|
| `tsc --noEmit` | sem erro |
| ESLint | 0 erros (avisos antigos de fast-refresh) |
| Vitest | 120 passando |
| `vite build` | ok |
| e2e novos (`login-configuracoes.spec.ts`) e axe de `/auth` e `/configuracoes` (4 projetos) | passando |
| e2e completo antes da última correção de largura | 208 passando, 4 falhas em `mascote.spec.ts` (abaixo) |

Capturas: `docs/capturas/login-configuracoes/` (celular e desktop, claro e escuro; tablet no desktop; login com mídia, sem mídia e Configurações). Duas rodadas, a primeira revelou o conteúdo estourando 360 px no celular, corrigido antes da segunda.

## Atenção
- **Falha que já existe na `main`:** `e2e/mascote.spec.ts` "se o mascote falhar, o app segue funcionando sem ele" quebra nos 4 projetos. `src/design-system/movimento.tsx` lê `navigator.hardwareConcurrency` no carregamento do módulo, sem proteção; o teste faz essa leitura lançar erro e o app não abre. Veio do PR #14 e não foi tocado aqui. Correção provável: envolver `leve()` em `try/catch`.
- **Limites no servidor:** o app valida no cliente. A validação no servidor depende das políticas do bucket `midia-login` descritas em `docs/lovable/16-avisos-e-midia-login.md`; não foram conferidas neste ambiente.
- **Logo nas capturas:** o ativo `/__l5e/assets-v1/...` não é servido pelo servidor local, então aparece só o texto alternativo (vale para o menu também).
- Vídeo: sem imagem de capa no cadastro; usa-se o primeiro quadro.
