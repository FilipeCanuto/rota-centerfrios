# Restrição de acesso por convite
- [x] Corrigir RLS e papéis por empresa em uma migração nova; regenerar tipos.
- [x] Conferir permissões com quatro contas temporárias e remover contas e registros temporários.
- [x] Verificar compilação e documentar resultados de RLS.
- [ ] Remover fisicamente usuarios.perfil e empresas.empresa_id: bloqueado pela permissão de migrações incompatíveis; colunas marcadas como obsoletas.
- [x] Aplicar uma nova migração com pré-cadastro de papéis e gatilho restritivo.
- [x] Preservar usuários existentes, src/ e migrações antigas.
- [x] Conferir configurações de autenticação e cenários 1–5; cinco testes passaram.
- [ ] Cenário 6: login Google real de Gmail depende de uma sessão Google indisponível nesta execução.
- [x] Documentar resultados e limitações da verificação.