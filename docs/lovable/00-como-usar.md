# Mensagens para o Lovable — fundação do banco

Cole uma mensagem por vez no Lovable, **na ordem dos números**, e só passe para a próxima quando a conferência do fim da mensagem der certo. Se o Lovable fizer algo diferente do pedido, anote e me avise na Etapa B.

| Ordem | Arquivo | Itens do relatório |
| --- | --- | --- |
| 1 | `01-acesso-e-cadastro.md` | C1 |
| 2 | `02-permissoes.md` | C2, C3, A1, A3 |
| 3 | `03-remanejamento-e-auditoria.md` | C4, A2 |
| 4 | `04-feriados.md` | C5 (tabela e feriados nacionais) |
| 5 | `05-indices.md` | A4 |
| 6 | `06-painel-agregado.md` | C8 |
| 7 | `07-dados-demonstracao.md` | C9 |
| 16 | `16-avisos-e-midia-login.md` | Avisos, mídia do login e permissão "Pode publicar avisos" |

Antes de colar a mensagem 01, troque `<EMAIL_DO_ADMINISTRADOR>` pelo e-mail de quem será o administrador.

Regras que valem para todas as mensagens (o próprio texto já repete isso ao Lovable):
- Toda mudança vira **migração nova**; nenhuma migração antiga é editada.
- O Lovable **não deve mexer nas telas** (`src/`), salvo onde a mensagem pede. As telas serão ajustadas no ramo `revisao-fundacao`.
- Uma mudança só está pronta quando a conferência no fim da mensagem passa.

---

## Resultado (11/11/2026)
As 7 mensagens foram enviadas pelo Claude Code direto ao projeto no Lovable. Os textos enviados de 01, 02, 03, 05, 06 e 07 ganharam ajustes de última hora em relação a estes arquivos: contas já existentes preservadas; supervisor por empresa; carga de feriados por função; demonstração recriada nas contas de Humberto e Clara. O histórico de mensagens do Lovable guarda a versão final. Custo aproximado: 23 créditos.

| Mensagem | Migração | Situação |
| --- | --- | --- |
| 01 Acesso | 0003 | Aplicada. Login Google com Gmail não testado (sem sessão Google) |
| 02 Permissões | 0004 | Aplicada. Colunas `usuarios.perfil` e `empresas.empresa_id` ficaram só marcadas como obsoletas (o Lovable bloqueia remoção sem a permissão "backward incompatible migrations") |
| 03 Remanejamento e auditoria | 0005 | Aplicada |
| 04 Feriados | 0006 | Aplicada; os 20 feriados entraram fora da migração (ver 07) |
| 05 Índices | 0007 | Aplicada; EXPLAIN pela API indisponível (HTTP 406), uso dos índices não confirmado |
| 06 Painel agregado | 0008 | Aplicada |
| 07 Demonstração | 0009, 0010 | Aplicada; `carregar_feriados_nacionais()` cobre bancos novos |

### Diferenças encontradas na conferência (Etapa B)
1. **`admin_atualizar_usuario` aceita `auth_user_id` e `created_at`** (0004). Um administrador pode ligar o próprio login à linha de um vendedor e passar a ver a carteira dele, contornando o C3. Correção: tirar `auth_user_id`, `created_at` e `demo` da lista de campos permitidos.
2. **Entrada em produção exige dois passos manuais:** `apagar_dados_demo()` e `carregar_feriados_nacionais()` (as migrações 0001 e 0002 continuam criando demonstração, e a 0006 cria a tabela vazia).
3. **Arquivos `tests/__pycache__/*.pyc` versionados** pelo Lovable. Correção: `__pycache__/` no `.gitignore` e tirar do repositório.
4. **Metas de demonstração** iguais nas duas empresas (R$ 120.000 cada). Na visão "ambas" a meta soma R$ 240.000. Só afeta a demonstração.
5. **Regra nova sem uso no app:** as telas ainda leem vendas linha a linha e não usam `painel_vendedor`, `cobertura_vendedor` nem a tabela `feriados`. Isso é a Etapa C (passo 2).

## Fase 1 (mensagens 10 a 15)
Cole na ordem: 10 clientes e notas · 11 importação Shop9 · 12 agenda · 13 links e arquivos · 14 gamificação · 15 gestão, copiloto, notificações e demonstração. Cada uma termina com "Como conferir".
