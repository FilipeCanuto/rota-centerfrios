# Relatório — fix/login-mascote

## 1. Login: nova análise e correções
**Falhas encontradas**
1. **"Esqueci minha senha" não chegava para quem foi convidado e nunca entrou.** O Supabase só manda o e-mail para quem já tem conta; para o convidado novo ele responde "sucesso" e não envia nada.
2. **Primeiro acesso com etapas demais:** nome, senha, confirmar e-mail e entrar de novo. Quem já tinha conta (Google) recebia "sucesso" sem nada acontecer.
3. **Link vencido que caía na página inicial perdia a explicação:** o redirecionamento para o login apagava o erro do endereço.
4. **Nenhuma conferência antes de enviar:** campo vazio, espaço no fim, letra maiúscula ou e-mail de fora da empresa só davam erro genérico depois de ir ao servidor.
5. **Tela de nova senha dependia de um evento que podia passar antes da hora** e de uma espera de 8 segundos.

**Como ficou (mais simples)**
- Só dois caminhos: **e-mail + senha**, ou **"Primeiro acesso ou esqueci a senha"**, que envia um **link de acesso** por e-mail. O mesmo link serve para o primeiro acesso (o banco confere o convite), para quem esqueceu a senha e para quem só entrava com o Google. Ao tocar no link, a pessoa já entra e cai em **"Crie sua senha"** (pode pular com "Agora não").
- Conferência antes de enviar: e-mail vazio, formato errado, domínio fora da empresa e senha vazia, com o foco indo para o campo certo. O e-mail é normalizado (sem espaços, minúsculas).
- Mensagens por causa: senha errada, e-mail não confirmado, muitas tentativas, link pedido há pouco, acesso não liberado.
- Links do e-mail (acesso, confirmação, convite, recuperação) e links vencidos são reconhecidos em qualquer página.
- Senha nova com pelo menos 8 caracteres e mensagens em português para senha fraca ou repetida.
- Continuam: cadastro só por convite (gatilho do banco), Google restrito a @centerfrios.com e @grupo381.com.br, nenhuma senha registrada.

## 2. Movimento no login, check e boas-vindas
- Login com entrada suave em cascata (logo, título, cartão, mascote), fundo com luzes que se movem devagar e o Pinguim flutuando de leve.
- Depois de entrar (senha ou link): **check animado** desenhado no centro (cerca de 1 s) e **"Bem-vindo, Nome!"** com o Pinguim (cerca de 1,3 s), e então o Início.
- Com "reduzir movimento" ligado no aparelho, tudo fica quase instantâneo. O leitor de tela anuncia "Login confirmado. Bem-vindo, Nome."
- Sem biblioteca nova: CSS próprio (`src/styles.css`) e `src/design-system/TransicaoEntrada.tsx`.

## 3. Mascote vetorizado
- Desenho em código (`src/design-system/mascote/`): cabeça preta com rosto creme, olhos azuis, bico laranja largo, moletom preto com capuz e cordões, calça cáqui, tênis creme e luvas pretas.
- **SVG de corpo inteiro** em `public/mascote/`: `pinguim-frente`, `pinguim-acenando`, `pinguim-apontando`, `pinguim-joinha`, `pinguim-bracos-cruzados`, `pinguim-pensativo`.
- **Rostos** (busto) em `public/mascote/`: `pinguim-rosto-neutro`, `-feliz`, `-atento`, `-comemorando`, `-determinado`, `-surpreso`.
- **No sistema:** o componente `Pinguim` passou a usar o busto novo, com as mesmas expressões do copiloto e os chapéus das versões (panificador, açougueiro, pizzaiolo).
- Regerar os arquivos: `node scripts/gerar-mascote.ts`.
- É uma vetorização estilizada (traço plano), não uma cópia do render 3D. Sombras, volume e as poses mais complexas da folha (caminhada, tablet) ficam para um ilustrador, se a marca quiser.

## Resultados
- Tipos (`tsc`): sem erros. Lint: 0 erros (15 avisos antigos de "fast refresh"). Regras (vitest): 101 testes passando. Build de produção: ok.
- Ponta a ponta + axe (celular 360 px e desktop, claro e escuro): **148 de 148** passando, com testes novos do login (validação antes de enviar, link de acesso, convite, senha errada × não confirmado, check e Bem-vindo, link que cai em outra página, link vencido).

## O que conferir à mão (Lovable Cloud)
1. Authentication → URL Configuration: *Redirect URLs* com o endereço publicado e o da prévia, com `/**` no fim (já estava no checklist).
2. Authentication → Email Templates: o modelo **Magic Link** (e o **Confirm signup**) precisa estar ativo. É ele que envia o "link de acesso". Vale traduzir o texto para português.
3. Limite de envio de e-mails: o envio padrão do Supabase é baixo (poucos e-mails por hora). Para o piloto com mais pessoas, configurar um SMTP próprio em Authentication → SMTP.
4. Testar com conta real: "Primeiro acesso ou esqueci a senha" → e-mail → link → Crie sua senha → check → Bem-vindo → Início.
