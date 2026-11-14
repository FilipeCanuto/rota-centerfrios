# Setores (Comercial, RH, Financeiro, Compras…)

Cada pessoa só entra nos setores liberados no cadastro (Configurações → Usuários e acessos). O setor é uma camada **somada** ao papel: para ver um dado é preciso o papel certo (políticas atuais) **e** o setor (políticas RESTRICTIVE com `tem_setor`). A tela só esconde; quem decide é o banco.

## Como funciona
- **Registro:** `src/modulos/setores/setores.ts` (chave, nome, ícone, rota inicial, prefixos de rota, `disponivel`). Setor com `disponivel: false` não aparece para ninguém.
- **Depois do login:** `/setores` usa `destinoAposLogin` (`src/regras/setores.ts`): 0 setores → "Sem acesso liberado"; 1 → vai direto; 2+ → cartões "Escolha o setor", com "Lembrar minha escolha" (guardado no aparelho). "Trocar de setor" fica no menu do avatar.
- **Guarda de rota:** um só ponto, o `beforeLoad` de `src/routes/_authenticated/route.tsx`. Rota fora de qualquer setor (ex.: `/configuracoes`) só exige login.
- **Banco:** `usuario_setores`, `tem_setor(usuario, setor)`, `meus_setores()` e as funções `admin_pre_cadastrar` / `admin_salvar_acessos` (auditadas). Texto em [lovable/18-setores-acesso.md](lovable/18-setores-acesso.md).

## Adicionar um setor novo em 3 passos
1. **Registro:** em `SETORES`, preencha a entrada (ou mude `disponivel` para `true` se ela já existe) com `rotaInicial` e os prefixos em `rotas`.
2. **Telas:** crie as rotas em `src/routes/_authenticated/<prefixo>…` e o módulo em `src/modulos/<setor>/`. A guarda e o seletor já valem para elas; o cadastro de usuários já mostra a caixa do setor novo.
3. **Banco (mensagem ao Lovable):** tabelas do setor com RLS + política `AS RESTRICTIVE FOR ALL TO authenticated USING ((select tem_setor('<chave>'))) WITH CHECK (…)`, e a mesma checagem no começo das funções `SECURITY DEFINER` do setor. A tabela `usuario_setores` não muda (a chave é texto livre `^[a-z][a-z_]{1,30}$`).

Para testar o seletor com dois setores sem publicar nada: `VITE_SETORES_PREVIA=rh` (o Playwright já liga isso).
