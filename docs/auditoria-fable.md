# Auditoria geral (sessão audit/fable, 16/11/2026)

Base: `origin/main` em `9622f53` (migrações até 0030). Método: leitura das migrações (`drizzle/migrations`), das regras (`src/regras`), dos hooks de dados e das rotas; `tsc`, `eslint`, `vitest` e `vite build` rodados. **Não havia banco local**: nada de SQL foi executado aqui; o que é de banco está em [lovable/22-auditoria.md](lovable/22-auditoria.md) com testes em SQL para o Lovable rodar.

Gravidade: **crítico** (vaza ou perde dado já), **alto** (número errado ou acesso indevido em uso normal), **médio** (errado em caso específico), **baixo** (higiene). A coluna "Situação" é preenchida na Fase 2.

## 1. Segurança

Nenhum achado crítico.

| Nº | Grav. | Achado | Arquivo e causa | Situação |
| --- | --- | --- | --- | --- |
| S1 | Alto | O administrador consegue virar diretoria (e ver a carteira) sozinho. | `0004`: `user_roles`, `usuario_empresas` e `papeis_pre_cadastro` têm `INSERT/UPDATE/DELETE` liberados a `authenticated` com política `eh_admin()`, então dá para gravar o papel direto pela API. `0023` `admin_salvar_acessos`: só impede tirar o próprio papel de administrador, não impede se dar `diretoria`. Fica auditado, mas não é barrado. Contraria a decisão C3 (administrador sem dados comerciais). || Corrigido no banco (texto 22) |
| S2 | Médio | Contato pode ser registrado para cliente de outra carteira ou empresa e com data antiga. | `0004` política `inserir` de `interacoes`: confere só `vendedor_id` e empresa; `cliente_id`, `data`, `demo` e `origem` são livres. Contato com data passada dá ponto de cobertura retroativo (`calcular_pontos_dia`) e aparece no histórico do cliente de outro vendedor para a gestão. || Corrigido no banco (texto 22) |
| S3 | Médio | Auditoria sem a trava de setor. | `0005` política `leitura_auditoria`: supervisor e diretoria sem o setor Comercial ainda leem `registro_auditoria`, que guarda o "antes e depois" de clientes (remanejamento). As demais tabelas comerciais têm a política RESTRICTIVE `setor_comercial` (`0023`, `0027`); esta ficou de fora. || Corrigido no banco (texto 22) |
| S4 | Médio | Post do Instagram aceita qualquer endereço e qualquer data. | `0017` `posts_instagram`: `url` sem checagem no banco (a tela só exige `http`), `data_post` livre (pontua o dia escolhido) e o mesmo post pode ser enviado várias vezes. O React 19 bloqueia `javascript:` no link, então não há XSS; o risco é ponto indevido se o supervisor aprovar sem abrir. || Corrigido no banco (texto 22) |
| S5 | Médio | Dados de demonstração podem ser carregados em produção pela API. | `0018` `carregar_dados_demo` segue liberada a `authenticated` (administrador ou diretoria): cria 60 clientes fictícios misturados aos reais. A função de apagar já foi restrita ao servidor (`0028`); a de carregar não. || Corrigido no banco (texto 22) |
| S6 | Médio | Conector: qualquer conector ativo fecha o envio de outro; corpo lido antes de autenticar. | `0030` `conector_resultado` não confere se o envio foi reservado por aquele conector. `src/integracoes/conectorServidor.server.ts`: lê até o corpo inteiro (5 MB) e consulta o banco antes de validar a assinatura, sem limite para quem não é conector. Hoje há um só conector e a assinatura é Ed25519, por isso médio. **Não corrigido aqui** (arquivos de outra sessão). | Só relatado |
| S7 | Baixo | Arquivos da Central de links: tipo conferido só pela extensão. | `0016` políticas do bucket `arquivos`: sem conferir `mimetype` nem tamanho (os 20 MB dependem da configuração do bucket, fora das migrações). Só diretoria e administrador enviam. Avisos e mídia do login estão corretos (`midia_arquivo_valido`). | Só relatado |
| S8 | Baixo | Funções auxiliares executáveis por anônimo. | `0000`/`0005`: `meu_usuario_id`, `tem_empresa`, `pode_ver_vendedor` nunca tiveram `REVOKE ... FROM PUBLIC`. Devolvem nulo/falso sem login; sem vazamento. | Só relatado |
| S9 | Baixo | `.env` versionado. | Só tem endereço e chave publicável (padrão do Lovable). Nenhum segredo no repositório. | Sem ação |

Conferido e correto: todas as funções `SECURITY DEFINER` têm `search_path` fixo; todas as tabelas têm RLS; a trava de setor usa `tem_setor()` (que já cobre `acesso_total`) e nunca a lista de setores; pontos, selos, carrinho, descontos e fila do Shop9 só são gravados por funções; `apagar_dados_demo` só no servidor; uploads de avisos e mídia do login validados no banco (tipo, tamanho); links só abrem `http(s)` (`src/modulos/links/acoes.ts`); o único `dangerouslySetInnerHTML` é o script fixo de tema; nenhum `console.log` com dado de cliente; `service_role` só em `*.server.ts`; rotas autenticadas com guarda única de login e setor (a guarda de papel é do banco: quem abrir `/gestao` ou `/configuracoes` pelo endereço sem o papel vê a tela vazia ou erro, sem dados).

## 2. Regras de negócio

| Nº | Grav. | Achado | Arquivo e causa | Situação |
| --- | --- | --- | --- | --- |
| R1 | Alto | Venda compartilhada (vendedor 1 e 2) não existe. | `0014` `importar_vendas`: toda venda vai 100% para o dono atual do cliente (`cli.vendedor_id`); a planilha nem tem coluna de vendedor (`src/regras/importacao.ts`). `docs/estrategia.md` (linha 152) diz que o atingimento "já aplica a regra de vendas compartilhadas". A API do Shop9 traz `codigoVendedor_1` e `codigoVendedor_2`. Falta a diretoria definir a divisão. | Decidido em 17/11 (50% para cada); texto 22 e planilha |
| R2 | Alto | Devolução e nota cancelada não descontam da meta. | `src/regras/importacao.ts`: valor negativo é recusado como erro. `vendas` não tem tipo, sinal nem situação; nada apaga ou zera uma nota cancelada. `faturado_mes` é a soma simples de `vendas.valor` (`0008`, `0018`, `gam_vendas_batida`). A API tem `/devolucao` e ativar/inativar saída. | Decidido em 17/11 (abatem do resultado); texto 22 e planilha |
| R3 | Alto | Reimportar uma venda antiga muda o vendedor dela. | `0014` `importar_vendas`, ramo de atualização: `UPDATE vendas SET vendedor_id=cli.vendedor_id`. Depois de um remanejamento, reimportar o histórico passa o faturamento passado para o novo dono: muda meta, ranking e pontos de meses fechados. || Corrigido no banco (texto 22) |
| R4 | Médio | "Data de faturamento" pode receber a data de emissão. | `src/regras/importacao.ts`: o campo aceita os apelidos `data` e `emissao`. A meta deve usar a data de efetivação; na API é `tipodata=E` em `/saidas`. | Relatado (ver 5) |
| R5 | Médio | Reativação: tela e pontos contam diferente. | `src/regras/painel.ts` `reativado`: exige 90 dias sem compra contados até o dia 1º do mês. `calcular_pontos_dia` (`0018`): 90 dias entre a compra anterior e a nova. Quem comprou em 15/09 e voltou em 20/12 ganha ponto, mas a tela mostra 0 reativados. || Corrigido no app |
| R6 | Médio | "Orçamento parado" com dois critérios. | Início e Gestão (`src/regras/painel.ts`, `gestao.ts`) usam o mais recente entre o último retorno e o último contato com o cliente. A tela Orçamentos (`src/regras/orcamentos.ts`) ignora o contato. Os números divergem entre telas. || Corrigido no app |
| R7 | Médio | Meta diária de cobertura: a tela pode mostrar "batida" sem ponto. | `src/regras/painel.ts`: o alvo desconta os clientes cobertos hoje e o "feito" não conta compra de hoje. `calcular_pontos_dia`: alvo pelos cobertos até ontem, feito = contato ou compra de hoje. Ex.: faltam 6 clientes, 2 dias úteis, 2 contatos hoje: tela 2 de 2, banco 2 de 3. Corrigir pede campo novo em `painel_vendedor`. | Relatado |
| R8 | Médio | Quem bate a meta do mês cedo para de ganhar pontos de vendas. | `0017` `gam_vendas_batida`: devolve falso quando o que falta é zero ou negativo. | Decidido em 17/11 (segue pontuando, com a média diária do mês); texto 22 e app |
| R9 | Médio | Carrinho conclui com preço antigo e produto inativo. | `0027` `concluir_carrinho`: usa o preço gravado quando o item entrou e não confere se o produto segue ativo; carrinho aberto não expira. | Decidido em 17/11 (preço sempre do dia; fora de linha impede concluir); texto 22 |
| R10 | Baixo | Sábado: a venda conta no mês, mas o dia não é útil. | App e banco tratam só segunda a sexta como útil: no sábado a tela mostra meta do dia e o banco não dá ponto. | Relatado |
| R11 | Baixo | Visão "ambas" usa a união dos feriados das empresas. | `src/regras/painel.ts` (`shortcut` documentado). | Relatado |
| R12 | Baixo | Pontos de dias passados dependem de alguém abrir a tela. | `calcular_pontos_dia` aceita qualquer dia e regrava com a meta de hoje (documentado em `progresso.md`). | Relatado |

Conferido e correto: fuso de Maceió no app (`dataLocal`) e no banco (`AT TIME ZONE 'America/Maceio'`); dia útil igual no app e no banco (segunda a sexta, menos feriados da empresa ou globais); cobertura (compra no mês ou contato qualificado) igual em `painel_vendedor`, `cobertura_vendedor`, `painel_gestao` e `calcular_pontos_dia`; "esquecido" e "90 dias" iguais no Início, na Gestão e em `remanejar_cliente`; carrinho com totais por item no servidor, limite de carrinhos com trava, um carrinho aberto por cliente (índice único), conclusão idempotente (trava + chave única), desconto validado ao adicionar, alterar e concluir, quem pede a liberação não decide e o supervisor respeita o teto; fila do Shop9 com transições válidas, reserva de 5 minutos e `SKIP LOCKED`; lotes do conector idempotentes.

## 3. Robustez

| Nº | Grav. | Achado | Arquivo e causa | Situação |
| --- | --- | --- | --- | --- |
| B1 | Alto | Queda de rede joga a pessoa para a tela de login. | `src/routes/_authenticated/route.tsx`: o `beforeLoad` chama `supabase.auth.getUser()` (vai ao servidor) a cada troca de tela; sem resposta, `data.user` vem nulo e a rota redireciona para `/auth`, mesmo com sessão válida. || Corrigido |
| B2 | Médio | Falha ao carregar a sessão vira "usuário sem papéis e sem empresas". | `src/modulos/sessao/sessao.tsx` `carregarSessao`: os erros de `usuarios`, `user_roles` e `empresas` são ignorados; o resultado vazio fica guardado por 60 s. Telas aparecem vazias e os atalhos de gestor somem, sem mensagem de erro. || Corrigido |
| B3 | Médio | Erro de permissão é repetido 3 vezes antes de aparecer. | `src/router.tsx`: `QueryClient` sem padrões; toda consulta com erro (inclusive "sem acesso") tenta de novo 3 vezes com espera, atrasando o `EstadoErro` em vários segundos. || Corrigido |
| B4 | Médio | Botão "Apagar dados de demonstração" sempre falha. | `src/routes/_authenticated/mais.tsx` e `src/modulos/configuracoes/dados.ts`: chamam `apagar_dados_demo`, que desde a `0028` só o servidor executa. || Corrigido (botão removido) |
| B5 | Baixo | Listas cortadas sem aviso. | `src/modulos/orcamentos/dados.ts` (200 orçamentos) e `src/modulos/clientes/dados.ts` (2.000 clientes para montar filtros, `shortcut` documentado). Total e "parados" ficam errados acima do corte. | Relatado |
| B6 | Baixo | Contato sem proteção contra toque duplo. | `src/modulos/contato/dados.ts`: `insert` simples; repetir cria dois contatos (não altera a cobertura, que conta clientes distintos). | Relatado |
| B7 | Baixo | Virada do dia com a tela aberta. | Documentado em `progresso.md`: as tarefas automáticas do novo dia só aparecem ao recarregar. | Relatado |

Sessão vencida: o Supabase renova o token sozinho; se a renovação falha ele emite `SIGNED_OUT` e o `__root.tsx` revalida as rotas, que levam ao login. Funciona; depende de B1 para não confundir "sem rede" com "sem sessão".

## 4. Desempenho

| Nº | Grav. | Achado | Arquivo e causa | Situação |
| --- | --- | --- | --- | --- |
| D1 | Médio | Uma ida ao servidor de autenticação antes de cada tela. | Mesmo `getUser()` do B1: toda navegação espera essa resposta. || Corrigido (com B1) |
| D2 | Médio | Tudo é recarregado a cada foco da janela e a cada troca de tela. | `src/router.tsx`: sem `staleTime` padrão. Voltar para a aba refaz todas as consultas ativas, inclusive `painel_vendedor` (carteira inteira em JSON, uma chamada por empresa). || Corrigido |
| D3 | Baixo | JavaScript inicial. | `vite build`: `index` 309 KB (97 KB comprimido) + `client` 216 KB (55 KB) + `route` 56 KB (17 KB), cerca de 170 KB comprimidos antes da primeira tela; as telas já são divididas por rota (110 arquivos). Aceitável; não mexido. | Relatado |
| D4 | Baixo | Consultas sem limite pequenas. | Feriados lidos inteiros em `orcamentos/dados.ts`; `painel_vendedor` devolve a carteira toda (decisão registrada). | Relatado |

Web Vitals (LCP, INP, CLS) não foram medidos nesta sessão; segue a pendência de medir em aparelho real (`DESEMPENHO=1 bun x playwright test e2e/desempenho.spec.ts`).

## 5. Prontidão para conexões

### 5.1 Shop9: PR #21 (conector) contra a documentação pública da Idealsoft

Fonte: <https://www.idealsoft.com.br/integracoes/> (módulo Integrações do Shop Control 9), lida em 16/11/2026. O PR #21 já está no `main`; revisão sem editar. O lado da Rota (assinatura Ed25519, nonce, limite de taxa, fila, lotes idempotentes) está sólido. O lado do Shop9 (`conector-shop9/src/shop9/adaptador.js`) foi escrito por suposição e **não bate com a documentação em nenhum ponto**; hoje só funciona contra o simulador.

| Tema | O que o conector faz | O que a documentação diz |
| --- | --- | --- |
| Autenticação | Cabeçalhos `x-shop9-serie`, `x-shop9-timestamp`, `x-shop9-signature` = HMAC em hexadecimal de `timestamp + caminho`. | `GET /auth/?serie=&codfilial=` devolve `token` e `expireAt` (UTC). Depois, em toda chamada: `Authorization: Token <token>`, `CodFilial`, `Timestamp` e `Signature` = Base64 de HMAC-SHA256 de `método em minúsculas + timestamp + Base64(corpo sem espaços nas pontas)`, com a senha do módulo. Token expira e deve ser renovado. |
| Erros | Usa o status HTTP (`r.ok`) e separa 4xx de 5xx. | Toda resposta volta **HTTP 200** com `{sucesso, mensagem, tipo, complementoTipo, statusCode, dados}`. Com o código atual, um erro do Shop9 seria tratado como sucesso. Decidir por `sucesso` e `tipo` (`AUTENTICACAO_INVALIDA`, `CAMPO_INVALIDO`, `REGISTRO_NAO_ENCONTRADO`, `LICENCA_EXPIRADA_OU_INVALIDA`…). |
| Paginação | `?filial=&desde=&limite=500`, resposta `Itens`, `Cursor`, `Mais`. | Página no caminho (`/clientes/1`, `/saidas/1`…), **20 registros por página** (10 em alguns), até vir `tipo = FIM_DE_PAGINA`. Filtro por data de alteração: `datade` e `dataate` (`AAAA-MM-DD HH:MM:SS`). A carga inicial são milhares de páginas: juntar páginas antes de chamar `sincronizar`. |
| Teste de vida | `GET /status`. | Não existe; usar `/auth` ou `/filiais/1`. |
| Orçamento | `POST /orcamentos` com `ChaveExterna`, `EmailVendedor`, `DescontoPct`. | Não existe `/orcamentos`. Orçamento é uma **saída**: `POST /saidas` (síncrono) ou `POST /vendas` (assíncrono, com recibo consultado em `GET /vendas/{recibo}`), com `codigoOperacao` (o código da operação de orçamento cadastrado no Shop9; tipos `ORC`, `DAV`, `PVN`…), `codigoCliente`, `codigoVendedor_1`, `codigoVendedor_2`, `data`, `usarValoresTabelaPrecos`, `produtos[{codigo, quantidade, precoUnitario, descontoUnitario}]`, `recebimentos`, `observacao`, `ReferenciaInterna`. Desconto é **valor por unidade**, não percentual. Vendedor é **código**, não e-mail. |
| Idempotência | Supõe que `ChaveExterna` impede duplicar. | Não há chave externa documentada. Candidato: `ReferenciaInterna`. Sem confirmação da Idealsoft, um envio que cai depois de criar e antes de responder **duplica o orçamento** na nova tentativa. Confirmar antes de ligar o modo conector. |
| Vendas | `/vendas` com `NumeroNota`, `DataFaturamento`… | `GET /saidas/{pág}?tipodata=E&datade=&dataate=&tiposoperacao=VND`: `tipodata` A = alteração, C = criação, **E = efetivação** (a data que a meta deve usar, R4). Detalhe em `/saidas/detalhes/{ordem}`. |
| Devoluções | Não trata. | `GET /devolucao/{pág}?tipodata=&datade=&dataate=` e `/devolucao/detalhes/{id}`; saída pode ser inativada (`PATCH /saidas/{id}/ativar`). Resolve R2 quando houver a regra. |
| Clientes | `RazaoSocial`, `Fone`, `EmailVendedor`. | `GET /clientes/{pág}?datade=&dataate=&ativo=A`; campos `nome`, `fantasia`, `cpfCnpj`, `telefone1`, `cidade`, `codigoClasse`, `vendedor1.codigo`, `vendedor2.codigo`, `limiteCredito`, `bloqueado` (serve para a situação financeira da ficha). O vínculo com o usuário da Rota precisa de um de-para **código do funcionário → e-mail** (`GET /funcionarios/{pág}?vendedor=true`). |
| Produtos e preços | `Codigo`, `Descricao`, `Preco`. | `GET /produtos/{pág}`, preços em `GET /v3/precos/{pág}` e tabelas em `/tabelasprecos/{pág}`; estoque em `/v2/estoque/{pág}`. Definir qual tabela de preço vale para a Rota. |
| Endereço do serviço | URL local do módulo, por ambiente. | "URL do serviço fornecida pela IdealSoft para o seu ambiente". Homologação: `http://idealsoftexportaweb.eastus.cloudapp.azure.com:60500/` (**HTTP sem TLS**). Série, filial de teste e senha: pedir a `suporte@idealsoft.com.br`. |
| Licença | — | O módulo exige Shop Control 9 **Corporate** e tem custo na renovação (`comercial@idealsoft.com.br`, (41) 3013-1161). Confirmar antes de homologar. |

Outros pontos do PR: o relógio do computador do conector precisa estar certo (janela de 5 minutos); `conector_resultado` não confere quem reservou (S6); `docs/shop9-mapeamento.md` ainda pede à Idealsoft itens que a documentação pública já responde (autenticação, paginação, filtros, devoluções). O que continua em aberto de fato: chave de idempotência, código da operação de orçamento, de-para de vendedor, tabela de preço, limites de requisição e se o Shop9 aceita o nosso preço e desconto.

### 5.2 WhatsApp (Evolution), e-mail e Instagram

| Canal | Hoje | Situação |
| --- | --- | --- |
| WhatsApp | `whatsappManual` (`src/integracoes/manual.ts`): só abre `wa.me`; nada é recebido nem registrado. Não havia adaptador da Evolution. | Esqueleto criado na Fase 2 |
| E-mail (IMAP/SMTP) | Não existia. | Esqueleto criado na Fase 2 |
| Instagram | `instagramManual`: o vendedor cola o endereço do post e o supervisor valida. Sem conexão com a conta. | Esqueleto criado na Fase 2 |

## 6. Dívidas

| Nº | Grav. | Achado | Arquivo e causa | Situação |
| --- | --- | --- | --- | --- |
| V1 | Baixo | Casts marcados `shortcut` que já podem sair. | Os tipos gerados já têm `setores`, `usuario_setores`, `avisos`, `midia_login`, `meus_setores` e as funções `admin_*`; os `supabase as any` de `avisos/dados.ts`, `configuracoes/midiaLogin.ts`, `setoresAdmin.ts`, `usuarios.ts`, `setores/setores.ts` e `sessao/sessao.tsx` ficaram. (`configuracoes/integracoesShop9.ts` é de outra sessão.) || Não feito (baixo; tirar com calma, um arquivo por vez) |
| V2 | Médio | Teste instável do Início no celular escuro. | `e2e/acessibilidade.spec.ts` (axe); `playwright.config.ts` com `retries: 0`. || Não corrigido. Em 17/11 o axe passou em 102 de 104; falharam às vezes, e passaram ao repetir, `/links` (largura 1.307 px no desktop durante a animação de entrada) e `/auth` (elemento não visível a tempo com o servidor de testes lento). Telas não mexidas nesta auditoria |
| V3 | Baixo | Prettier em `SimularAlertas.tsx`. | Único erro do `eslint` (linha 37, mais de 100 colunas); os outros 26 itens são avisos `react-refresh`. || Corrigido |
| V4 | Médio | Preferências e silêncio das notificações. | `preferencias_notificacao` existe (`0018`) e o mascote já a lê (`src/modulos/mascote/dados.ts`); faltam a tela de preferências e o silêncio no sino fora do expediente. || Não feito (tela nova; próxima etapa) |
| V5 | Médio | Botão "Apagar dados de demonstração". | Ver B4. || Corrigido (B4) |
| V6 | Baixo | `docs/progresso.md` desatualizado. | Etapas "aguarda PR" que já estão no `main`; mensagens 17 a 19 como "não enviadas" com as migrações 0023 a 0026 aplicadas; carrinho "sem telas". || Corrigido |

## 7. Decisões da diretoria (17/11/2026)

| Tema | Decisão | Como ficou |
| --- | --- | --- |
| Venda compartilhada | Vendedor 1 é o principal, vendedor 2 o segundo; 50% para cada. | `vendas.vendedor_2_id`; `parte_venda()` dá a parte de cada um em `painel_vendedor`, `painel_gestao` e `gam_vendas_batida`. A planilha aceita "E-mail do vendedor 2". O vendedor 2 e o supervisor dele passam a ver a venda. |
| Devolução e cancelamento | Abatidos do resultado. | Devolução gravada negativa (`vendas.tipo = 'devolucao'`, código `DEV:<nº>`) no mês em que acontece, com os vendedores da nota de origem; não conta como compra (recompra, cobertura, última compra, reativação). Nota cancelada é apagada na importação. |
| Pontos depois da meta | Continua acumulando. | Meta do mês batida: a meta do dia vira a média diária (meta ÷ dias úteis do mês), no app (`metaDoDia`) e no banco (`gam_vendas_batida`). |
| Carrinho | Valor sempre atualizado no dia. | Cada recálculo do carrinho (incluir, alterar, remover, concluir) usa o preço de tabela atual; produto fora de linha impede concluir. |

Ficha do cliente: a seção "Últimas compras e devoluções" marca a devolução com selo e valor negativo; "Compras em 12 meses" e o ticket médio contam só vendas, e o total de 12 meses já vem líquido (texto 22, teste 10). Itens da venda compartilhada: o vendedor 2 e o supervisor dele também leem (texto 22, teste 11). A tela `/vendas-compartilhadas` (atalho no "Mais") lista as vendas com dois vendedores de quem está logado, com cliente, outro vendedor, sua parte e itens, pela função `minhas_vendas_compartilhadas` (texto 22, teste 12). A ficha do cliente continua só para quem tem o cliente na carteira.
