# Setores (Comercial, RH, Financeiro, Compras…)

Cada pessoa só entra nos setores liberados no cadastro (Configurações → Usuários e acessos). O setor é uma camada **somada** ao papel: para ver um dado é preciso o papel certo (políticas atuais) **e** o setor (políticas RESTRICTIVE com `tem_setor`). A tela só esconde; quem decide é o banco.

## Como funciona
- **Catálogo:** tabela `setores` (chave, nome, ícone, `ativo`, `disponivel`), editável pelo administrador em Configurações → Setores (criar, renomear, ativar/desativar; nunca excluir; `disponivel` só por migração/deploy). Setor ativo recebe acesso no cadastro; só aparece no login/seletor se `ativo` **e** `disponivel` **e** houver módulo em `MODULOS` (`src/modulos/setores/setores.ts`: chave → descrição, rota inicial, prefixos de rota). Texto do banco em [lovable/19-setores-editaveis-e-enquadramento.md](lovable/19-setores-editaveis-e-enquadramento.md).
- **Depois do login:** `/setores` usa `destinoAposLogin` (`src/regras/setores.ts`): 0 setores → "Sem acesso liberado"; 1 → vai direto; 2+ → cartões "Escolha o setor", com "Lembrar minha escolha" (guardado no aparelho). "Trocar de setor" fica no menu do avatar.
- **Guarda de rota:** um só ponto, o `beforeLoad` de `src/routes/_authenticated/route.tsx`. Rota fora de qualquer setor (ex.: `/configuracoes`) só exige login.
- **Banco:** `usuario_setores`, `tem_setor(usuario, setor)`, `meus_setores()` e as funções `admin_pre_cadastrar` / `admin_salvar_acessos` (auditadas). Texto em [lovable/18-setores-acesso.md](lovable/18-setores-acesso.md).

## Adicionar um setor novo em 3 passos
1. **Registro:** em `MODULOS` (`src/modulos/setores/setores.ts`), acrescente a chave com `descricao`, `rotaInicial` e os prefixos em `rotas`. O setor já existe na tabela (criado na aba Setores ou na migração).
2. **Telas:** crie as rotas em `src/routes/_authenticated/<prefixo>…` e o módulo em `src/modulos/<setor>/`. A guarda e o seletor já valem para elas; o cadastro de usuários já mostra a caixa do setor novo.
3. **Banco (mensagem ao Lovable):** tabelas do setor com RLS + política `AS RESTRICTIVE FOR ALL TO authenticated USING ((select tem_setor('<chave>'))) WITH CHECK (…)`, e a mesma checagem no começo das funções `SECURITY DEFINER` do setor. Com o módulo pronto, mude `disponivel` para `true` por migração (a tela nunca altera). A tabela `usuario_setores` não muda (a chave é texto livre `^[a-z][a-z_]{1,30}$`).

Para testar o seletor com dois setores sem publicar nada: `VITE_SETORES_PREVIA=rh` (o Playwright já liga isso).
