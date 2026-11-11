# Plataforma Comercial CENTERFRIOS — Estratégia de Produto e Implementação

Nov 10, 2026 · @CENTERFRIOS

## Visão geral

A plataforma é a camada de inteligência e ação comercial do Grupo CENTERFRIOS: o Shop9 continua sendo a verdade fiscal e de cadastro, e a plataforma transforma esses dados, somados às conversas de WhatsApp, em tarefas claras para cada vendedor. A promessa ao time cabe numa frase: **nenhum cliente esperando, nenhum cliente esquecido.**

Nome recomendado: **Rota CENTERFRIOS** (opções e critérios na seção a seguir), com o mascote Pinguim sempre na tela como rosto do copiloto de cada vendedor.

**Princípios que guiam todas as decisões**

- **Abrir e saber o que fazer em 5 segundos.** A tela inicial responde três perguntas: como estou na meta, quem está me esperando, quem eu devo procurar hoje.
- **Shop9 é a fonte da verdade.** A plataforma lê do Shop9 e nunca duplica regra fiscal; tudo que é novo (conversas, agenda, alertas, notas) vive no banco próprio.
- **Mobile em primeiro lugar.** Toda tela nasce para o celular e depois se expande para o desktop.
- **Acessível por padrão.** Conformidade com a WCAG 2.2 nível AA é critério de entrega, não etapa final.
- **Leve de usar.** O sistema registra sozinho tudo o que puder (conversas, compras, contatos) para o vendedor digitar o mínimo.
- **Duas empresas, um sistema.** CENTERFRIOS e 381 Distribuidora compartilham a plataforma, com dados separados e troca de empresa em um toque.

## Nome da plataforma

A recomendação é **Rota**, apresentada como "Rota CENTERFRIOS". É curta, vira verbo na rotina ("já abriu a Rota hoje?") e diz o que a plataforma faz: mostra o caminho do dia até a meta.

Os nomes foram avaliados por quatro critérios: fácil de falar e lembrar, profissional, que chame para a ação e que converse com a marca.

| Nome | A ideia | Como soa na rotina | Ponto de atenção |
| --- | --- | --- | --- |
| **Rota** (recomendado) | O caminho do dia até a meta; o plano do dia vira "a rota" | "Abre a Rota", "o que tem na minha Rota hoje?" | Palavra comum; usar sempre junto da marca |
| Norte | Direção e foco; combina com o universo polar do Pinguim | "Qual é o seu Norte hoje?" | Soa mais estratégico do que operacional |
| Pulso | Os sinais vitais da carteira e de cada cliente | "Toma o pulso da carteira antes de sair" | Um pouco mais abstrato |
| Cresce | Vem do slogan "Crescendo com você" | "Já lançou no Cresce?" | Diz menos sobre o que o sistema faz |
| Radar | Enxerga oportunidades antes que o cliente esfrie | "Deu no Radar: cliente atrasado na recompra" | Com o monitoramento das conversas, pode soar como vigilância para o time |

Com Rota, o vocabulário do sistema acompanha o nome: o plano do dia vira "Sua rota de hoje", a temporada mensal da gamificação vira "Rota do mês" e os selos viram "Marcos da rota".

Teste rápido antes de decidir: apresentar os três finalistas para Clara e Humberto e ver qual deles eles repetem no dia seguinte. Uma busca no INPI e de domínio evita confusão com outro produto.

## Perfis e permissões

Cada pessoa vê apenas o que precisa para agir: o vendedor vê a própria carteira, o supervisor vê a equipe, a diretoria vê tudo. A separação é garantida no banco de dados (regras por linha), não só escondendo botões na tela.

| Perfil | O que vê | O que faz |
| --- | --- | --- |
| Vendedor | Sua carteira, suas conversas, sua meta e sua agenda | Atende, registra contatos, agenda retornos, envia links e arquivos |
| Supervisor | Carteiras e conversas da equipe, filas e alertas escalados | Redistribui clientes, cobre ausências, acompanha tempos de resposta |
| Diretoria | Todas as empresas, equipes e indicadores | Define metas, regras de alerta e políticas; vê relatórios consolidados |
| Administrador | Configurações técnicas | Gerencia usuários, conexões de WhatsApp, integrações e central de links |
| Representante externo (futuro) | Apenas os clientes atribuídos a ele | Registra visitas e oportunidades, com acesso restrito |
| Assistente de IA | Conversas do número oficial que atende | Qualifica e entrega ao vendedor; nunca fecha preço nem prazo |

Uma pessoa pode ter acesso às duas empresas (CENTERFRIOS e 381). Nesse caso, um seletor de empresa fica no topo da tela e todos os números se ajustam à empresa escolhida, com a opção de visão somada para a diretoria.

## Escopo funcional por módulo

O sistema tem nove módulos, organizados para que o vendedor passe 90% do tempo em três deles: Início, Conversas e Clientes.

| Módulo | O que entrega | Fase |
| --- | --- | --- |
| Início (painel do vendedor) | Gráfico principal de meta com projeção do mês; gráfico menor de cobertura da carteira; indicador de cobertura sempre visível no topo; plano do dia priorizado; fila "aguardando resposta"; alertas de recompra e clientes esquecidos | 1 |
| Clientes (CRM) | Lista da carteira com filtros e etiquetas; ficha 360 com compras, ticket médio, itens comprados, situação financeira, conversas, notas e saúde do cliente | 1 |
| Agenda | Retornos, visitas e ligações; lembretes; tarefas criadas automaticamente pelos alertas; visão dia, semana e lista; sincronização opcional com Google Agenda | 1 |
| Central de links e arquivos | Aba "Ferramentas internas" (revisor de documentos e outros apps); aba "Para enviar ao cliente" (catálogos, site, Instagram, localização das lojas, fichas técnicas); envio direto para a conversa | 1 |
| Orçamentos | Orçamentos abertos vindos do Shop9, com status de follow-up e alerta de orçamento parado | 1 |
| Conversas (WhatsApp) | Caixa de entrada dos números conectados; fila por tempo de espera; envio de texto, áudio, imagens, PDFs e links; respostas rápidas; vínculo automático conversa-cliente | 2 |
| Gestão | Painel do supervisor e da diretoria: metas, cobertura, tempo de resposta, orçamentos parados e alertas por vendedor; redistribuição de carteira | 2 |
| Inteligência | Análise diária das conversas por IA (oportunidades perdidas); sugestão de mix; rastreio de abertura de links; Instagram na gamificação; copiloto pessoal que conversa (ex.: Beto) | 3 |
| Atendimento por IA | Agente no número oficial que qualifica o cliente e entrega ao vendedor um resumo pronto para orçamento | 4 |

A central de links é administrada por quem tem perfil de administrador: cada link tem título, descrição curta, ícone, empresa (CENTERFRIOS, 381 ou ambas) e público (interno ou cliente). Links para cliente ganham um rastreador próprio, para o vendedor saber quando o cliente abriu.

## O que ainda faltava

A revisão encontrou doze acréscimos leves que elevam a experiência sem pesar o sistema. Todos reaproveitam dados que a plataforma já terá.

**Para o vendedor decidir melhor**

1. **Projeção e ritmo da meta.** Além do percentual atingido, o gráfico mostra a projeção de fechamento no ritmo atual e quanto falta vender por dia útil. É a informação que mais muda comportamento no meio do mês.
2. **Saúde do cliente.** Um selo simples (saudável, atenção, em risco) calculado por recência, frequência e valor de compra. Substitui a leitura de várias colunas por um olhar.
3. **Calendário do segmento.** Lembretes sazonais ligados aos clientes certos: panificação antes da Páscoa e do fim de ano, campanhas como a Blue Friday, aniversário da empresa cliente.
4. **Mensagens prontas no tom da marca.** Modelos aprovados pela diretoria, alinhados ao posicionamento consultivo do PRD (sem comunicação baseada em preço), com campos que se preenchem sozinhos.

**Para o sistema ser agradável de usar**

5. **Busca global.** Uma busca única (atalho Ctrl+K no desktop, lupa no celular) que encontra cliente, conversa, produto, link ou tarefa.
6. **Central de notificações com preferências.** Cada pessoa escolhe o que recebe e como; fora do horário de trabalho as notificações ficam em silêncio.
7. **Instalação como aplicativo (PWA).** O vendedor instala no celular pelo navegador, com ícone, tela cheia e notificações push, sem passar por loja de aplicativos.
8. **Estados vazios que ensinam.** Toda tela sem dados explica o que vai aparecer ali e qual o primeiro passo.
9. **Tour de boas-vindas.** Um passo a passo curto no primeiro acesso, e uma ajuda contextual em cada tela.
10. **Desfazer em vez de confirmar.** Ações reversíveis mostram "Desfazer" por alguns segundos, em vez de janelas de confirmação que interrompem.

**Para a gestão confiar nos números**

11. **Higiene de cadastro.** Alerta de cliente sem telefone, telefone duplicado ou fora do padrão. Sem isso, cobertura e vínculo de conversas ficam imprecisos.
12. **Histórico de atividades e exportação.** Registro de quem fez o quê (redistribuições, alterações de meta) e exportação de relatórios em PDF e planilha.

Ficam fora de propósito para manter o sistema leve: chat interno entre vendedores (o Telegram já cumpre esse papel), emissão de pedidos (continua no Shop9) e editor de campanhas de marketing.

## Gamificação, copiloto e mascote

A gamificação transforma os resultados do dia em pontos, ranking e selos, e o copiloto com o mascote Pinguim é quem avisa, comemora e orienta o vendedor. Só conta ponto o que é verificável no Shop9, no WhatsApp ou no Instagram, para que o jogo premie resultado e não esforço aparente.

**Metas diárias que geram pontos**

| Indicador | Meta do dia | Como é calculada |
| --- | --- | --- |
| Vendas faturadas | Ritmo necessário | (Meta do mês − faturado até ontem) ÷ dias úteis restantes; recalculada todo dia, então quem atrasa vê a meta do dia subir |
| Orçamentos | Número de orçamentos emitidos no Shop9 | Meta definida pela diretoria por perfil (loja, televendas, CPF) |
| Cobertura da carteira | Clientes com interação real no dia | (Meta mensal de cobertura − cobertura atingida) ÷ dias úteis restantes, em número de clientes e arredondada para cima; recalculada todo dia, como a meta de vendas (decisão de 11/11/2026) |
| Clientes sem comprar | Clientes em alerta de recompra que voltaram a comprar | Meta definida pela diretoria; conta no dia do faturamento |
| Instagram (Fase 3) | Postagens de divulgação e interação | Ver regras do Instagram abaixo |

**Regras do jogo**

- **Pesos definidos pela diretoria:** venda faturada vale mais que orçamento; cobertura e reativação valem mais que Instagram.
- **Temporada mensal, ranking semanal:** a pontuação zera a cada mês e o ranking da semana dá fôlego a quem começou mal.
- **Selos e sequências:** por exemplo "Carteira 100%", "Resposta relâmpago" e "5 dias seguidos batendo a meta do dia".
- **Ranking sem humilhação:** cada vendedor vê sua posição e o pódio; a lista completa fica com supervisor e diretoria.
- **Ligação com a premiação:** regras escritas e aprovadas antes do piloto; validar com a contabilidade a forma de pagamento dos prêmios.
- **Acessível:** comemorações curtas, desligadas quando o aparelho pede movimento reduzido, e posição no ranking sempre em texto, não só em cor.

**Instagram do vendedor**

- A API oficial atende apenas [contas profissionais (comercial ou criador)](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login), sem precisar de página do Facebook. Desde o fim da [Basic Display API em dezembro de 2024](https://www.getphyllo.com/post/instagram-api-guide), não há caminho oficial para contas pessoais, então as contas dos vendedores são criadas já como profissionais.
- Com a autorização do vendedor, o sistema lê as publicações e as [métricas de cada post](https://developers.facebook.com/docs/instagram-platform/insights), como alcance e interações.
- Para ler contas de várias pessoas, o aplicativo da empresa precisa passar pela [revisão da Meta e pela verificação da empresa](https://bundle.social/blog/instagram-graph-api); prever esse prazo na Fase 3.
- Regra padrão aprovada: essa forma de conexão não lê marcações, então o post conta ponto quando a legenda cita @centerfriosoficial ou a hashtag da campanha.
- Pontua publicação e interação recebida, nunca número de seguidores.
- Conexão obrigatória: a conta do vendedor é corporativa, criada com aparelho, e-mail e dados da empresa, e a empresa mantém o acesso quando ele deixa a equipe. O sistema só lê publicações e métricas; nunca publica nem lê mensagens diretas.

**Copiloto com apelido**

- Cada vendedor tem um copiloto com apelido derivado do próprio nome: Humberto → Beto. O sistema sugere três opções e o vendedor escolhe ou escreve a sua.
- O copiloto fala em primeira pessoa e no tom consultivo da marca: "Beto aqui: dois clientes estão esperando resposta há mais de 15 minutos."
- Na Fase 1 ele entrega avisos e dicas; na Fase 3 passa a conversar e responder perguntas sobre a carteira do próprio vendedor. Com o ElevenLabs, o copiloto também ganha voz: um resumo da manhã em áudio de 30 segundos ("Bom dia, Humberto, aqui é o Beto...").

**Mascote Pinguim na tela**

- O Pinguim é o rosto do copiloto, com o apelido escolhido pelo vendedor. Ele pode usar a versão do mascote que combina com o segmento do vendedor (Consultor, Panificador, Açougueiro ou Pizzaiolo).
- Expressões por momento: neutro, comemorando (meta do dia batida), avisando (cliente esperando) e pensando (IA analisando).
- Posição fixa no painel (topo no celular, canto do painel no desktop), sem flutuar sobre o conteúdo, e com opção de minimizar.
- Redesenho do Pinguim em traço limpo e vetorial no estilo premium, com animações leves em formato próprio para web.
- Para leitores de tela, a ilustração é decorativa; o que importa é a mensagem do copiloto, anunciada como texto.

## Regras de negócio dos indicadores e alertas

Cada número do painel precisa de uma definição única, escrita antes do código, para que vendedor, supervisor e diretoria leiam a mesma coisa. Os limites abaixo são sugestões iniciais, a calibrar durante o piloto; todos ficam editáveis pela diretoria nas configurações.

| Indicador ou alerta | Definição | Fonte |
| --- | --- | --- |
| Atingimento da meta | Vendas faturadas no mês ÷ meta do vendedor, já aplicando a regra de vendas compartilhadas da política comercial | Shop9 |
| Projeção do mês | Vendas até hoje ÷ dias úteis decorridos × dias úteis do mês | Shop9 + calendário |
| Ritmo necessário | (Meta − vendas até hoje) ÷ dias úteis restantes | Shop9 + calendário |
| Carteira ativa | Clientes atribuídos ao vendedor; cliente sem compra há mais de 90 dias pode ser remanejado pelo supervisor | Shop9 |
| Cobertura da carteira | Clientes da carteira ativa com ao menos uma interação qualificada no mês ÷ carteira ativa | Plataforma + Shop9 |
| Interação qualificada | Conversa em que o cliente respondeu, visita ou ligação registrada com resultado, ou compra no mês. Mensagem enviada sem resposta não conta | Plataforma + Shop9 |
| Alerta de recompra | Intervalo médio entre as últimas compras (mínimo de 3 compras). Atenção quando o atraso passa de 1,5× o intervalo; urgente a partir de 2×. Exemplo: média de 20 dias → atenção aos 30, urgente aos 40 | Shop9 |
| Cliente esquecido | Cliente da carteira ativa sem interação qualificada há mais de 30 dias | Plataforma |
| Aguardando resposta | Última mensagem da conversa é do cliente. Contado só em horário comercial: aviso ao vendedor com 15 min, ao supervisor com 30 min | WhatsApp |
| Orçamento parado | Orçamento aberto sem interação há 2 dias úteis | Shop9 + plataforma |
| Dias úteis | Segunda a sexta, menos os feriados nacionais, estaduais e municipais e os dias sem expediente da empresa (Carnaval, Corpus Christi etc.), todos tratados da mesma forma. A diretoria edita a lista em Configurações → Feriados e dias sem expediente | Plataforma |
| Saúde do cliente | Combinação de recência, frequência e valor de compra em três faixas: saudável, atenção, em risco | Shop9 |

**Decisões da diretoria (reunião de 10/11/2026)**

- Meta medida por **venda faturada**.
- Cobertura conta só **interação real**; mensagem sem resposta não conta.
- Cliente sem compra há **90 dias** pode mudar de carteira; quem muda é o **supervisor**, e a mudança fica no histórico.
- Limites iniciais dos alertas **aprovados**.
- Piloto da Fase 1 com **Clara e Humberto**.
- Só números corporativos de WhatsApp, com política interna assinada pela equipe. Instagram dos vendedores também em conta corporativa, com conexão obrigatória.
- Em aberto: horário comercial de referência para o tempo de resposta.

## Experiência do usuário

A tela inicial é uma lista de prioridades, não um relatório: o que está em cima é o que o vendedor deve fazer primeiro. Tudo o que é análise mais longa fica um toque abaixo.

**Ordem da tela inicial (de cima para baixo)**

1. **Barra superior:** seletor de empresa, busca, notificações e o selo discreto de cobertura da carteira (ex.: "Cobertura 62%"), sempre visível em todas as telas.
2. **Meta do mês (gráfico principal):** percentual atingido, valor que falta, projeção de fechamento e ritmo necessário por dia útil.
3. **Cobertura da carteira (gráfico menor):** clientes cobertos ÷ carteira ativa, com atalho para a lista dos que faltam.
4. **Aguardando resposta:** conversas paradas, a mais antiga primeiro, com o tempo de espera em destaque.
5. **Plano do dia:** até 10 clientes priorizados (recompra atrasada, orçamento parado, cliente esquecido, retorno agendado), cada um com o motivo e um botão de ação.
6. **Alertas e oportunidades:** sugestões da IA e avisos do dia, recolhíveis.

**Navegação**

- **Celular:** barra inferior com cinco destinos ao alcance do polegar: Início, Conversas, Clientes, Agenda e Mais (central de links, orçamentos, gestão, configurações). Ações secundárias abrem em painéis que sobem da base da tela.
- **Desktop:** menu lateral recolhível com os mesmos destinos, e telas em duas colunas onde fizer sentido (lista à esquerda, detalhe à direita), como em Conversas e Clientes.

**Padrões de interação**

- Toda ação principal a no máximo dois toques da tela inicial.
- Conversas seguem os padrões do WhatsApp que o time já conhece: balões, horário, confirmação de leitura, anexos.
- Carregamento com esqueletos de conteúdo em vez de telas brancas; erros explicam o que aconteceu e o que fazer.
- Arrastar é sempre opcional: tudo que se arrasta também tem botão equivalente.
- Textos do sistema no tom da marca: consultivo, direto, sem jargão técnico.

**Telas principais:** Início · Conversas (lista e conversa) · Clientes (lista e ficha 360) · Agenda · Orçamentos · Central de links · Notificações · Gestão (supervisor e diretoria) · Configurações · Guia do design system (rota interna).

## Design system

O design system se chama **Polar** e traduz a identidade azul e amarela da CENTERFRIOS para uma interface sóbria: o azul conduz, o amarelo aponta, e os neutros dão o ar elegante. Ele é construído em três camadas de tokens, para que trocar o tema claro pelo escuro, ou ajustar a marca, seja mudar variáveis e não telas.

**Direção aprovada pela diretoria:** a identidade da CENTERFRIOS numa versão premium, elegante e sofisticada. Na prática: azul profundo, quase marinho, como base; amarelo num tom mais quente, quase dourado, usado só como acento; muito espaço em branco; títulos refinados e pesos leves no texto; ícones de traço fino; sombras quase invisíveis; e um modo escuro que funciona como vitrine, com superfícies em azul-noite.

**Paleta proposta do Polar**

Valores iniciais para aprovação, a conferir com o manual da marca. Todos os pares de texto já foram medidos e passam na WCAG AA; o contraste indicado é contra a superfície no tema claro e contra o fundo no escuro.

| Papel | Tema claro | Tema escuro | Contraste (claro / escuro) | Uso |
| --- | --- | --- | --- | --- |
| Fundo | #F7F8FB (gelo) | #0A1730 (azul-noite) | — | Fundo das telas |
| Superfície | #FFFFFF | #12223F | — | Cartões e painéis |
| Texto principal | #0B1F44 (marinho) | #E9EDF5 | 16,2:1 / 15,2:1 | Títulos, textos, valores |
| Texto secundário | #5B6577 | #A9B4C8 | 5,9:1 / 8,5:1 | Legendas, datas, apoio |
| Primária | #1B4FA0 (azul profundo) | #7FA8F0 | 7,9:1 / 7,4:1 | Botões, links, gráfico de meta |
| Ouro (destaque) | #E8B43A, com texto marinho | #F2C14E | 8,5:1 / 10,6:1 | Selos, conquistas, cobertura, ponto atingido |
| Borda de campo | #5B6577 | #8A96AB | 5,9:1 / 6,0:1 | Campos e controles |
| Divisória | #C9D3E3 | #2B3A55 | decorativa | Linhas entre blocos |
| Sucesso | #1E7A50 | #4CC38A | 5,3:1 / 8,1:1 | Meta batida, cliente saudável |
| Atenção | #9A5B00 | #F2C14E | 5,4:1 / 10,6:1 | Recompra atrasada, sempre com ícone e palavra |
| Perigo | #B42318 | #FF8A80 | 6,6:1 / 7,8:1 | Urgente, cliente esperando |

**Tipografia proposta**

- **Títulos:** Akko, se a licença web cobrir; senão **Plus Jakarta Sans**, gratuita, geométrica e elegante.
- **Texto e números:** **Inter**, com algarismos tabulares para valores e percentuais alinhados.
- **Números de destaque** (meta, cobertura, pontos): grandes, em peso semibold e espaçamento levemente fechado; é o detalhe que mais passa sensação premium no painel.

**Assinatura premium**

- Ouro como joia: aparece só em conquistas, no ponto atingido do gráfico de meta e nos selos; nunca em botões comuns.
- Cartões com borda fina e quase sem sombra; um único degradê azul-noite, discreto, no cabeçalho do painel.
- Comemoração curta em ouro quando o vendedor bate a meta do dia, desligada quando o aparelho pede movimento reduzido.
- Pinguim redesenhado em traço único marinho com detalhe ouro, em versões claras e escuras.
- Modo escuro como vitrine: superfícies em camadas de azul-noite, sem preto puro.

**Camadas de tokens**

| Camada | Exemplo | Para que serve |
| --- | --- | --- |
| Primitivos | `azul-700`, `amarelo-400`, `cinza-100` | A paleta bruta, tirada do manual da marca |
| Semânticos | `--cor-fundo`, `--cor-superficie`, `--cor-texto`, `--cor-primaria`, `--cor-destaque`, `--cor-sucesso`, `--cor-atencao`, `--cor-perigo` | O significado de cada cor; é o que os componentes usam |
| Componentes | `--botao-primario-fundo`, `--cartao-borda` | Ajustes finos de um componente sem afetar os outros |

**Cor e temas**

- **Claro, escuro e automático:** o padrão segue o sistema do aparelho, com opção manual nas configurações. A escolha fica salva por usuário.
- **Modo escuro elegante:** fundos em azul-noite (não preto puro), superfícies em camadas levemente mais claras, e o amarelo dessaturado para não ofuscar.
- **Regra de ouro do amarelo:** amarelo nunca é cor de texto sobre fundo claro, porque não atinge o contraste mínimo. Ele aparece como preenchimento (selos, destaques, gráfico de meta) com texto em azul-escuro por cima.
- **Status com redundância:** verde, amarelo e vermelho sempre acompanhados de ícone e palavra ("Urgente", "Atenção"), nunca só cor.
- **Valores exatos:** os hexadecimais de azul e amarelo vêm do manual da marca; cada par de cores aprovado é verificado com um medidor de contraste antes de entrar no sistema.

**Tipografia**

- **Títulos:** Akko, se a licença da fonte cobrir uso na web; caso contrário, uma alternativa geométrica de licença livre com o mesmo espírito.
- **Texto e números:** uma fonte de alta legibilidade em telas pequenas, com algarismos tabulares para que valores e percentuais fiquem alinhados.
- **Escala:** 12 · 14 · 16 · 20 · 24 · 32 px, com texto de corpo em 16 px no celular. Tamanhos em `rem`, para respeitar o ajuste de fonte do aparelho.

**Espaço, forma e movimento**

- Grade de 4 px; espaçamentos em múltiplos de 4 e 8.
- Cantos arredondados de 8 px em cartões e 6 px em botões; sombras mínimas, preferindo bordas finas.
- Animações curtas (150 a 250 ms) e desativadas quando o aparelho pede movimento reduzido.
- Ícones de traço fino, de uma única família, sempre com rótulo de texto ou nome acessível.

**Componentes do Polar**

Base (vindos do shadcn/ui, que o Lovable já usa, construídos sobre primitivos acessíveis): Botão, Campo, Seleção, Caixa de seleção, Interruptor, Abas, Diálogo, Painel inferior, Menu, Dica, Aviso temporário, Tabela, Calendário.

Próprios da plataforma: Anel de meta, Selo de cobertura, Cartão de indicador, Item de alerta, Linha de cliente, Selo de saúde do cliente, Balão de conversa, Compositor de mensagem com anexos, Cartão de link, Estado vazio, Paleta de busca.

**Semântica**

- HTML com significado: `header`, `nav`, `main`, `aside`, `section` nomeadas pelo título, listas como `ul`/`ol`, dados tabulares em `table`, datas em `time`, valores calculados em `output`.
- `button` para ações e `a` para navegação, sem exceções.
- Uma hierarquia de títulos por tela (um `h1`, seções em `h2`), que também é o roteiro do leitor de tela.
- Nomes no código em português claro e consistente com a interface (`CartaoDeIndicador`, `seloCobertura`).

**Documentação viva:** uma rota interna `/design-system` mostra cada token e componente em claro e escuro, com exemplos de uso certo e errado. Fica dentro do próprio app, sem ferramenta extra.

## Acessibilidade (WCAG 2.2 AA)

A meta é conformidade com a WCAG 2.2 nível AA em todas as telas, verificada a cada entrega. Isso também atende ao espírito da Lei Brasileira de Inclusão e beneficia todo o time: quem usa o celular no sol, com uma mão só, ou com a fonte aumentada.

**Requisitos que mais pesam neste sistema**

| Tema | Requisito | Como aplicar aqui |
| --- | --- | --- |
| Contraste | Texto 4,5:1; texto grande, ícones, bordas de campos e partes de gráficos 3:1 | Pares de cores do Polar pré-aprovados nos dois temas; amarelo só como fundo |
| Cor não é a única pista | Informação nunca depende só de cor | Alertas com ícone e palavra; gráficos com rótulos de valor |
| Gráficos | Alternativa em texto | Cada gráfico tem resumo em uma frase e opção "ver como tabela" |
| Teclado | Tudo operável por teclado, foco sempre visível e nunca escondido por barras fixas | Ordem de foco lógica; link "Pular para o conteúdo"; atalhos documentados |
| Toque | Alvos de no mínimo 24×24 px (o Polar adota 44×44 px) | Botões da barra inferior e da fila de conversas dimensionados para o polegar |
| Arrastar | Alternativa sem arrastar | Mover tarefa ou cliente também por menu |
| Reflow e zoom | Funciona a 320 px de largura e com texto em 200% sem perder conteúdo | Layout fluido, sem rolagem horizontal |
| Avisos dinâmicos | Mensagens de status anunciadas ao leitor de tela | Novas mensagens e alertas em regiões `aria-live` discretas, sem roubar o foco |
| Movimento | Respeitar preferência de movimento reduzido | Animações desligadas quando o aparelho pede |
| Formulários | Rótulos visíveis, erros em texto e sem pedir o mesmo dado duas vezes | Validação junto ao campo; dados reaproveitados do Shop9 |
| Login acessível | Sem testes de memória ou quebra-cabeças | Aceitar gerenciadores de senha e chave de acesso (passkey) |
| Ajuda consistente | Ajuda no mesmo lugar em todas as telas | Ícone de ajuda fixo no menu |

**Como garantir na prática**

- [ ] Verificação automática com axe em cada tela, nos testes de ponta a ponta
- [ ] Regras de acessibilidade no analisador de código (eslint-plugin-jsx-a11y)
- [ ] Teste manual a cada fase com TalkBack (Android), VoiceOver (iPhone) e NVDA (Windows)
- [ ] Teste só com teclado e com zoom de 200% antes de cada entrega
- [ ] Acessibilidade no checklist de "pronto" de toda tarefa

## Arquitetura técnica

A plataforma usa a pilha nativa do Lovable (React no navegador, Supabase no servidor), e toda integração passa por funções no servidor. Assim o aplicativo fica leve no celular e nenhuma credencial fica exposta.

&#91;embedded content: arquitetura · aplicativo, servidor e quatro serviços externos\]

O servidor é o centro: ele busca os dados do Shop9, recebe as mensagens do WhatsApp, calcula indicadores e alertas e conversa com a IA.

**Decisões técnicas**

- **Shop9:** leitura pelo módulo Integrações, copiando clientes, vendas, orçamentos e produtos para tabelas espelho no Supabase. Os cálculos rodam sobre o espelho, então o painel abre rápido e o Shop9 não é sobrecarregado. A frequência de sincronização depende dos limites da API, a confirmar na homologação.
- **WhatsApp dos vendedores (QR Code):** exige um serviço de conexão (como a Evolution API) rodando 24 horas num servidor próprio, porque as funções do Supabase não mantêm conexões permanentes. As mensagens chegam ao sistema por webhook.
- **WhatsApp da IA:** número exclusivo na API oficial da Meta (WhatsApp Cloud API), com webhooks direto para as funções.
- **IA:** API do Claude chamada apenas pelo servidor. A análise das conversas roda em lote durante a noite, o que reduz custo. O copiloto de cada vendedor só enxerga os dados do próprio vendedor.
- **Tempo real:** a fila "aguardando resposta" e as notificações atualizam na hora, sem recarregar a tela.
- **Notificações push:** pela PWA, no Android e no iPhone (com o app adicionado à tela inicial).
- **Arquivos:** guardados no armazenamento do Supabase e enviados por links temporários.
- **Gráficos:** Recharts (padrão do shadcn/ui), envolvido em componentes do Polar com texto alternativo e opção de tabela.

**Plataformas e assinaturas**

As quatro assinaturas da empresa cobrem o projeto, com um cuidado: as assinaturas de uso pessoal do Claude e do ChatGPT não incluem uso por API. O sistema precisa de uma conta de API própria, cobrada por consumo.

| Plataforma | Papel no projeto | Observação |
| --- | --- | --- |
| Lovable | Telas, banco de dados, funções e publicação | O consumo do banco e das funções cresce com o uso; acompanhar o painel de uso |
| Claude | Claude Code para construir e revisar o código; API do Claude para analisar conversas e dar voz ao copiloto | A API é contratada à parte, no Console da Anthropic |
| ElevenLabs | Transcrição dos áudios do WhatsApp para a IA analisar; voz do copiloto; voz da IA de atendimento na Fase 4 | Áudio é parte grande das conversas de venda; confirmar se o plano atual cobre o volume |
| ChatGPT | Apoio à equipe na criação de modelos de mensagem e de conteúdo para o Instagram | Fica fora do sistema: um único provedor de IA dentro dele simplifica custos e LGPD |

## Segurança, LGPD e governança

O sistema vai guardar conversas com clientes e dados comerciais, então segurança e LGPD são requisitos desde o primeiro dia. Este capítulo deve ser revisado pelo jurídico antes da Fase 2.

**Segurança**

- Senhas, chaves do Shop9, do WhatsApp e da IA ficam só no servidor (cofre de segredos), nunca no aplicativo do navegador.
- Cada consulta ao banco passa por regras por linha: o vendedor fisicamente não consegue ler a carteira de outro.
- Login com verificação em duas etapas obrigatória para diretoria e administradores.
- Registro de auditoria para ações sensíveis: troca de carteira, exportações, mudanças de meta e de permissão.
- Backups automáticos diários e ambiente de homologação separado do de produção.

**LGPD e monitoramento de conversas**

- Apenas números corporativos são conectados; números pessoais dos vendedores ficam fora.
- Termo ou política interna assinada pela equipe informando que as conversas dos números da empresa são registradas e analisadas, e para quê.
- Aviso ao cliente de que o atendimento pode ser assistido por IA e registrado, com link para a política de privacidade da empresa.
- Prazo de guarda definido para conversas e arquivos, com exclusão automática ao fim do prazo.
- Dados enviados à IA reduzidos ao necessário, com provedor contratado em termos que não usam os dados para treinar modelos.
- Encarregado de dados (DPO) definido e canal para o cliente pedir acesso ou exclusão dos próprios dados.

**Governança**

- A diretoria é dona das regras: metas, limites de alerta, modelos de mensagem e central de links.
- Mudanças de regra entram em vigor a partir de uma data, sem reescrever o histórico.

## Roadmap de implementação

A construção acontece em cinco fases, e cada uma termina com algo que o time já usa no dia a dia. Uma fase só começa quando o portão anterior é cumprido, o que evita construir telas sobre dados que ainda não existem.

&#91;embedded content: roadmap · 5 fases e 4 portões de avanço\]

A Fase 1 entrega valor antes do WhatsApp: com os dados do Shop9 e a agenda, o vendedor já tem meta, alertas de recompra e uma cobertura provisória (clientes com compra ou contato registrado no mês). Quando o WhatsApp entra, na Fase 2, a cobertura passa a contar as conversas.

**Estimativa de prazo (a confirmar após a homologação do Shop9)**

| Fase | Estimativa |
| --- | --- |
| 0 · Fundação | 2 semanas |
| 1 · Painel do vendedor | 4 semanas |
| 2 · WhatsApp e gestão | 4 semanas |
| 3 · Inteligência | 3 a 4 semanas |
| 4 · Atendimento por IA | piloto contínuo, ajustado semana a semana |

O maior fator de prazo é externo: o tempo da Idealsoft para liberar as credenciais e a documentação do módulo Integrações. A Fase 0 pode começar antes disso, pelo design system e pela estrutura do projeto.

## Fluxo de trabalho: Lovable + GitHub + Claude Code

Cada ferramenta faz o que faz melhor: o Lovable desenha e publica, o Claude Code constrói o que é profundo, e o GitHub é o ponto de encontro com histórico de tudo.

| Ferramenta | Papel | Exemplos |
| --- | --- | --- |
| Lovable | Estrutura inicial, telas, ajustes visuais rápidos, publicação | Criar a tela de Agenda; ajustar espaçamentos do painel; publicar nova versão |
| Claude Code | Integrações, regras de negócio, banco de dados, testes, revisões de acessibilidade e desempenho | Sincronização com o Shop9; cálculo de cobertura; conexão do WhatsApp; testes automáticos |
| GitHub | Fonte única do código, histórico, revisão de mudanças | Cada mudança do Claude Code chega como proposta revisável antes de entrar |

**Regras de convivência**

1. O Lovable trabalha sobre o ramo principal. O Claude Code trabalha em ramos separados e só junta ao principal depois de revisado; o Lovable recebe a mudança automaticamente.
2. Nunca editar a mesma tela no Lovable e no Claude Code ao mesmo tempo.
3. Um arquivo `CLAUDE.md` na raiz do repositório guarda as regras do projeto: Polar, acessibilidade, nomes, estrutura de pastas. O mesmo conteúdo vai para o conhecimento do projeto no Lovable, para as duas ferramentas seguirem o mesmo padrão.
4. Mudanças no banco de dados só por migrações versionadas no repositório, nunca editando o banco à mão.
5. Dois ambientes: homologação (com as credenciais de teste do Shop9) e produção.

**Estrutura de pastas sugerida**

- `src/design-system/` — tokens e componentes do Polar
- `src/modulos/` — uma pasta por módulo (inicio, conversas, clientes, agenda, orcamentos, links, gestao)
- `src/regras/` — cálculos de indicadores e alertas, com testes
- `supabase/migrations/` e `supabase/functions/` — banco e funções de servidor
- `docs/` — este documento, decisões técnicas e definições de indicadores

**Definição de pronto (toda tarefa)**

- [ ] Funciona no celular (360 px) e no desktop
- [ ] Funciona no tema claro e no escuro
- [ ] Estados de carregamento, vazio e erro desenhados
- [ ] Passa na verificação automática de acessibilidade e no teste só com teclado
- [ ] Regras de negócio com teste automático
- [ ] Usa apenas tokens e componentes do Polar

## Métricas de sucesso, riscos e próximos passos

O sistema terá dado certo se, em três meses de uso, os clientes esperarem menos e menos clientes forem esquecidos. As métricas abaixo medem exatamente isso e são acompanhadas desde o piloto, comparadas com o ponto de partida.

| Métrica | O que mostra |
| --- | --- |
| Tempo médio de primeira resposta no WhatsApp | Se os clientes estão esperando menos |
| Cobertura média da carteira no mês | Se mais clientes estão sendo atendidos |
| Clientes em alerta de recompra que voltaram a comprar | Se os alertas geram venda |
| Conversão de orçamento em venda | Se o follow-up está funcionando |
| Vendedores que usam o sistema todos os dias | Se a ferramenta foi adotada |

**Riscos e como reduzir**

| Risco | Como reduzir |
| --- | --- |
| O módulo Integrações do Shop9 não expor algum dado (ex.: vendas por cliente, orçamentos) | Validar a lista de dados com a Idealsoft na homologação, antes de desenhar as telas que dependem deles |
| Bloqueio de número conectado por QR Code | Evitar disparos em massa; usar a API oficial no número que terá IA; monitorar a saúde de cada conexão |
| Baixa adesão da equipe | Sistema que registra sozinho, plano do dia pronto, piloto com quem tem mais afinidade, rotina diária do supervisor dentro da ferramenta, reconhecimento ligado à premiação |
| Indicadores contestados | Definições escritas e aprovadas antes do código; tela "como este número é calculado" em cada indicador |
| Custo de IA crescer com o volume | Análise em lote noturna; limites por vendedor; painel de consumo |
| Exposição de dados | Regras por linha, segredos só no servidor, auditoria e revisão jurídica da LGPD |

**Próximos passos**

- [x] Diretoria responder às perguntas em aberto das regras de negócio
- [x] Definir os vendedores do piloto da Fase 1: Clara e Humberto
- [ ] Escolher o nome entre Rota, Norte e Pulso, com o teste rápido no piloto
- [ ] Aprovar a paleta e a tipografia do Polar, conferidas com o manual da marca
- [ ] Receber da Idealsoft as credenciais de homologação e a documentação do módulo Integrações
- [ ] Contratar a API do Claude e confirmar o volume de transcrição no plano do ElevenLabs
- [ ] Criar as contas corporativas de Instagram dos vendedores, já como profissionais
- [ ] Encomendar o redesenho do Pinguim no estilo premium
- [ ] Criar o projeto no Lovable, conectar ao GitHub e registrar as regras do `CLAUDE.md`
