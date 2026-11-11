Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Central de links e arquivos.

## 1. Links para as duas empresas e com arquivo
Em `links`:
- `empresa_id` passa a aceitar nulo (= vale para as duas empresas);
- adicione `arquivo_path text` (caminho no armazenamento; quando preenchido, o link é um arquivo), `mensagem_whatsapp text` (texto pronto para enviar ao cliente), `ordem int not null default 0` e `ativo boolean not null default true`.

Ajuste a política de leitura para `empresa_id is null or tem_empresa(empresa_id)`, e só linhas `ativo = true` para quem não é administrador. A escrita continua com diretoria ou administrador.

## 2. Armazenamento
Bucket privado `arquivos`, com limite de 20 MB por arquivo e tipos PDF, JPG, PNG e WEBP. Políticas em `storage.objects` para esse bucket:
- **ler:** qualquer usuário autenticado;
- **enviar, substituir e apagar:** só administrador.

O app gera links temporários (assinados, 7 dias) para enviar ao cliente.

## Como conferir
1. Administrador cria um link sem empresa e envia um PDF ao bucket: funciona.
2. Vendedor de teste vê o link e gera link assinado do PDF; não consegue enviar arquivo nem criar link.
3. Link com `ativo = false` não aparece para o vendedor.
Apague os dados de teste.
