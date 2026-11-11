# Remanejamento e auditoria protegidos

- Uma migração nova; nenhuma tela alterada; regenerar somente os tipos em `src/`.
- Aceitar supervisores globais ou com papel em qualquer empresa no helper de carteira, mantendo a exigência de vínculo à empresa nas políticas.
- Bloquear gravação direta de auditoria e definir leituras separadas para diretoria, supervisores e administradores técnicos.
- Auditar metas, regras, permissões, vínculos e mudanças de vendedor com valores anteriores e novos.
- Criar remanejamento com motivo mínimo, checagem de equipe/empresa e prazo configurável pela data de America/Maceio.
- Testar os nove cenários com contas temporárias e apresentar resultados; apagar contas, registros e auditorias de teste.

## Detalhes técnicos
- A marca interna de remanejamento será local à transação e conferida junto ao contexto privilegiado da função, não apenas pelo texto da marca.
- Cada remanejamento gera uma única auditoria; alterações feitas pela integração também são auditadas.
- O prazo comercial se aplica ao remanejamento, inclusive pela diretoria; a integração continua podendo trocar o vendedor.
- UPDATE direto por diretoria já é bloqueado pela RLS (zero linhas), antes do gatilho; o gatilho é uma proteção adicional.