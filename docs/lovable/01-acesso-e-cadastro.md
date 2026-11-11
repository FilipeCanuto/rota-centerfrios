Preciso fechar o acesso da plataforma: hoje qualquer pessoa cria conta e ganha acesso às duas empresas. Faça só as mudanças abaixo, numa **migração nova**, sem editar migrações antigas. **Não altere nenhum arquivo em `src/`**; a tela de login será ajustada em outro ramo.

## 1. Cadastro só por convite
- **Não** desative o cadastro nas configurações de autenticação: desativado, ele também bloqueia o primeiro login com Google de quem foi convidado. O bloqueio é feito pelo gatilho do item 3, que recusa qualquer cadastro sem pré-cadastro.
- Mantenha a confirmação de e-mail ligada para cadastro por senha.
- Mantenha o login por e-mail e senha e o login com Google.

## 2. Domínios permitidos
Só podem entrar e-mails terminados em **`@centerfrios.com`** ou **`@grupo381.com.br`** (comparação sem diferenciar maiúsculas e minúsculas). Vale para e-mail e senha e para Google.

## 3. Reescrever a função `ao_criar_usuario` (gatilho `on_auth_user_created` em `auth.users`)
Comportamento novo, nesta ordem:
1. Se o e-mail do novo usuário não for de um dos dois domínios permitidos, **recusar** a criação com a mensagem "Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora."
2. Procurar em `public.usuarios` uma linha **pré-cadastrada** com o mesmo e-mail (sem diferenciar maiúsculas e minúsculas) e `auth_user_id` vazio.
3. Se não houver, **recusar** a criação com a mensagem "Seu acesso ainda não foi liberado. Peça o convite ao administrador."
4. Se houver, preencher `auth_user_id` dessa linha com o id do novo usuário. **Não** criar vínculos de empresa nem papéis automaticamente: eles já vêm do pré-cadastro feito pelo administrador.
5. **Remover** a regra antiga "o primeiro usuário do banco vira administrador".
6. **Remover** a regra antiga que vinculava novos usuários aos vendedores de demonstração (Humberto e Clara) e a que ligava o novo usuário a todas as empresas.

## 4. Papéis do pré-cadastro e administrador atual
- Crie a tabela `public.papeis_pre_cadastro (usuario_id uuid → usuarios.id, role app_role, empresa_id uuid nulo = todas, origem, created_at)`, com RLS ligada e leitura e escrita só para `administrador`. No passo 3.4, ao vincular o `auth_user_id`, a função copia esses papéis para `public.user_roles` e apaga as linhas copiadas.
- **Não crie um novo administrador.** O e-mail `filipecanuto@centerfrios.com` já tem login, está ligado à linha "Humberto" de `usuarios` e já tem o papel `administrador` em `user_roles`. Mantenha exatamente assim. O mesmo vale para `adm@centerfrios.com`, ligado à linha "Clara". Não altere nem apague esses dois usuários nesta mensagem.

## 5. Como o administrador convida alguém (só documentar, sem tela agora)
Para liberar uma pessoa, o administrador cria a linha em `usuarios` com o e-mail dela, os vínculos em `usuario_empresas` e o papel em `papeis_pre_cadastro`. Depois, a pessoa entra com Google ou cria a própria senha em "Primeiro acesso" (cadastro com o e-mail da empresa, que só passa se houver pré-cadastro). Registre esse processo num comentário na migração.

## Como conferir
Rode e me mostre o resultado de cada item:
1. Tentar criar um usuário com e-mail `teste@gmail.com` → deve falhar com a mensagem de domínio.
2. Tentar criar `nao.convidado@centerfrios.com` (sem pré-cadastro) → deve falhar com a mensagem de convite.
3. Pré-cadastrar `convidado.teste@grupo381.com.br` com papel `vendedor` e criar o usuário de autenticação → deve funcionar; conferir que `usuarios.auth_user_id` foi preenchido, que `user_roles` tem só `vendedor` e que `papeis_pre_cadastro` ficou vazio para ele. Depois, apagar esse usuário de teste.
4. Os usuários filipecanuto@centerfrios.com e adm@centerfrios.com continuam com o mesmo login e os mesmos papéis.
5. A consulta da definição de `public.ao_criar_usuario` não contém mais os textos "Humberto", "Clara" nem a regra do primeiro usuário.
6. Login com Google de uma conta `@gmail.com` → recusado com a mensagem de domínio.
