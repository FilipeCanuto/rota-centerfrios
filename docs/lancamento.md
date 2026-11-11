# Checklist de lançamento — primeiro uso real

Tudo o que precisa acontecer antes de Clara e Humberto usarem a Rota com dados reais. Atualizado a cada passo da revisão.

## 1. Banco de dados
- [ ] Entrar como administrador ou diretoria e rodar `select public.apagar_dados_demo();`. Conferir o resumo devolvido: não pode sobrar nenhuma linha com `demo = true`.
- [ ] Rodar `select public.carregar_feriados_nacionais();`, que carrega os 20 feriados nacionais de 2026 e 2027 e devolve quantos inseriu.
- [ ] Conferir que CENTERFRIOS e 381 Distribuidora existem e estão com `demo = false`.

## 1b. Dados do Shop9 (Mais → Importar planilhas do Shop9, diretoria)
- [ ] Exportar do Shop9 e salvar como CSV: clientes (com o e-mail do vendedor), vendas faturadas (uma linha por item, se possível) e orçamentos.
- [ ] Importar nesta ordem: clientes → vendas → orçamentos. Corrigir na planilha as linhas do relatório de erros e importar de novo (reimportar não duplica).
- [ ] Conferir na tela Início de cada vendedor: faturado do mês e cobertura.

## 2. Calendário (Configurações → Feriados e dias sem expediente)
- [ ] Cadastrar os feriados estaduais de Alagoas, pela lista oficial da contabilidade.
- [ ] Cadastrar os feriados municipais (Maceió e demais cidades com loja), pela lista da contabilidade.
- [ ] Cadastrar os dias sem expediente de cada empresa (Carnaval, Corpus Christi e outros), marcando "data móvel" quando o dia mudar a cada ano.
- [ ] Conferir os dias úteis do mês corrente na tela Início (projeção e meta do dia).

## 3. Pessoas e papéis
- [ ] Pré-cadastrar Clara e Humberto (vendedores do piloto) em `usuarios`, com o e-mail corporativo, os vínculos de empresa (`usuario_empresas`) e o papel `vendedor` em `papeis_pre_cadastro`, por empresa quando couber.
- [ ] Pré-cadastrar o supervisor do piloto, com o papel `supervisor` na empresa certa, e ligar a equipe a ele (`equipes.supervisor_id`), com Clara e Humberto nessa equipe.
- [ ] Cadastrar as metas do mês de Clara e Humberto (diretoria).
- [ ] Conferir as contas fixas: Filipe Canuto (administrador + diretoria) e Willames Costa (administrador), nas duas empresas.

## 4. Login
- [ ] No Lovable Cloud (Authentication → URL Configuration), incluir o endereço publicado e `/redefinir-senha` (ex.: `https://<endereço>/redefinir-senha`) nas URLs de redirecionamento permitidas. Sem isso, o link de "Esqueci minha senha" não abre a tela de nova senha.
- [ ] Testar "Esqueci minha senha" com uma conta real: o e-mail chega, o link abre a tela "Crie uma nova senha" e a senha nova funciona.
- [ ] Testar "Primeiro acesso" de um vendedor convidado: cria a senha, confirma pelo e-mail e entra.

## 5. Testes de acesso
- [ ] Login com Google de uma conta `@gmail.com`: tem que ser **recusado** com "Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora."
- [ ] Login de alguém de `@centerfrios.com` sem convite: tem que ser recusado com "Seu acesso ainda não foi liberado."
- [ ] Vendedor: vê só a própria carteira, meta e agenda; não vê a carteira do colega.
- [ ] Supervisor: vê a equipe; consegue remanejar só cliente com 90 dias ou mais sem compra, e a troca aparece na auditoria.
- [ ] Diretoria: vê as duas empresas; edita metas, regras e feriados.
- [ ] Administrador: gerencia usuários e links; não vê carteira, vendas nem metas.

## 6. Publicação
- [ ] Juntar ao `main` os PRs aprovados da revisão e publicar pelo Lovable.
- [ ] Abrir o app publicado no celular de Clara e Humberto e instalar como aplicativo.
