# Feriados nacionais e dias úteis

- Criar `feriados` em uma migração nova, com campos solicitados, unicidade incluindo empresa nula, índice por data e abrangência validada.
- Permitir leitura autenticada dos feriados globais ou das empresas acessíveis; somente diretoria pode cadastrar, alterar ou apagar.
- Reutilizar o gatilho genérico de auditoria com ação `alteracao_feriado`.
- Carregar exatamente as 20 datas fornecidas por meio da ferramenta de dados, separadamente da migração de estrutura.
- Regenerar os tipos; preservar telas e migrações antigas. Não conectar as telas à tabela nesta etapa.
- Verificar as 20 linhas e os 19 dias úteis em novembro de 2026; testar vendedor e diretoria com contas temporárias, conferir auditoria e limpar os dados de teste.