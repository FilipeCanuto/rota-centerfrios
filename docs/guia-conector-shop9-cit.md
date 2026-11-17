# Conector Shop9 — guia de instalação (TI)

O conector é um programa pequeno que roda **no computador onde está o módulo Integrações do Shop9**. Ele conversa com o Shop9 pela rede local e com a Rota pela internet, **só por conexões de saída HTTPS**. Nenhuma porta é aberta para a internet.

```
Shop9 (Integrações) ←rede local→ Conector ──HTTPS saída 443──→ Rota
```

Este arquivo não contém senhas nem chaves. Nunca cole credenciais em chamados, e-mails ou no repositório.

## 1. Requisitos do computador
- Windows 10/11 ou Windows Server, **sempre ligado** (sem suspensão nem hibernação; desative em Opções de energia).
- Node.js **22 LTS** (22.12 ou mais novo), instalado para todos os usuários: <https://nodejs.org>. O conector não usa nenhuma biblioteca externa.
- Acesso ao módulo Integrações do Shop9 (endereço local, série e senha fornecidos pela Idealsoft).
- Relógio do Windows certo (sincronizado pela internet): a Rota recusa pedidos com mais de 5 min de diferença.
- Saída para a internet na porta 443.

## 2. Instalação
1. Copie a pasta `conector-shop9` para `C:\Program Files\ConectorShop9\0.2.0\`.
2. Crie `C:\ProgramData\ConectorShop9\` e copie para lá `config.exemplo.json` com o nome `config.json`.
3. Preencha no `config.json`: `rota_url` (sempre `https://`) e as credenciais do Shop9:
   - `shop9.homologacao`: **servidor de teste da Idealsoft** (`http://idealsoftexportaweb.eastus.cloudapp.azure.com:60500`) com série, filial e senha **de teste**. O conector recusa outro endereço aqui.
   - `shop9.producao`: o **módulo na rede local** (ex.: `http://192.168.0.20:PORTA` ou o nome do servidor). O conector recusa endereço de internet aqui: a credencial de produção nunca sai da rede.
   Os códigos não sensíveis (filial, operação de orçamento, tabela de preço, caixa) **não** vão neste arquivo: o administrador preenche em Configurações → Integrações → Códigos por empresa.
4. Pareamento: o administrador da Rota clica em Configurações → Integrações → **Parear conector** e recebe um código de 8 caracteres (vale 10 minutos, uma vez só). Neste computador (PowerShell como administrador, na pasta do programa): `npm run parear -- CODIGO "Nome do computador"`. O conector cria a **chave privada** em `C:\ProgramData\ConectorShop9\chave-privada.pem` (nunca sai daqui), apresenta só a pública à Rota e grava o `conector_id` no `config.json`.
5. Proteja o arquivo (PowerShell como administrador):
   ```powershell
   icacls "C:\ProgramData\ConectorShop9" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administradores:(OI)(CI)F"
   ```
   Só o sistema (que roda o serviço) e administradores leem a pasta.
   Alternativa para a senha do Shop9: a variável de ambiente `SHOP9_SENHA` da tarefa tem prioridade sobre o arquivo.
6. Teste manual: `node "C:\Program Files\ConectorShop9\0.2.0\src\servico.js"`. Em até 1 minuto a Rota mostra **Online** e a versão. Pare com Ctrl+C.

## 3. Rodar como serviço (Agendador de Tarefas, sem instalar nada)
PowerShell como administrador:
```powershell
$acao = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument '"C:\Program Files\ConectorShop9\atual\src\servico.js"'
$gatilho = New-ScheduledTaskTrigger -AtStartup
$conf = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName "ConectorShop9" -Action $acao -Trigger $gatilho -Settings $conf -User "SYSTEM" -RunLevel Highest
New-Item -ItemType Junction -Path "C:\Program Files\ConectorShop9\atual" -Target "C:\Program Files\ConectorShop9\0.2.0"
Start-ScheduledTask -TaskName "ConectorShop9"
```
A tarefa sobe com o Windows, sem ninguém logado, e reinicia sozinha se cair.

## 4. Firewall
- **Entrada:** nenhuma regra nova. O conector não escuta porta nenhuma.
- **Saída:** liberar só HTTPS (TCP 443) para o endereço da Rota, e a porta do módulo Integrações na rede local.

## 5. Atualização segura
1. Baixe a nova versão só do repositório oficial e confira o SHA-256 informado na publicação (`Get-FileHash arquivo.zip`).
2. Extraia em uma pasta nova (`...\ConectorShop9\0.3.0\`), sem apagar a anterior.
3. `Stop-ScheduledTask ConectorShop9`, aponte a junção `atual` para a nova pasta, `Start-ScheduledTask ConectorShop9`.
4. Confira na Rota a versão nova e **Online**. Deu problema: aponte `atual` de volta para a pasta anterior e reinicie.

O `config.json` e a `chave-privada.pem` ficam em `C:\ProgramData\ConectorShop9` e não mudam na atualização. A posição da sincronização fica guardada na Rota.

## 5a. Troca de chave e revogação
- Troca de rotina (ex.: uma vez por ano ou quando um técnico sai): `npm run trocar-chave` e reinicie a tarefa em até 10 minutos. A chave anterior vale só nesses 10 minutos.
- Computador perdido ou suspeita de vazamento: na Rota, **Revogar** (vale na hora). Para voltar, gere novo código e rode `npm run parear` de novo.

## 6. Diagnóstico
| Sintoma | Onde olhar | O que fazer |
| --- | --- | --- |
| Rota mostra **Offline** | `C:\ProgramData\ConectorShop9\logs\conector.log` | Ver se a tarefa está rodando (`Get-ScheduledTask ConectorShop9`), internet e relógio do Windows (diferença acima de 5 min é recusada) |
| Log com `status: 401` | — | Conector revogado, chave trocada sem reiniciar ou relógio errado: confira o relógio; se revogado, gere código na Rota (**Parear de novo**) e rode `npm run parear -- CODIGO` |
| Log com `shop9_indisponivel` | `tipo` no log | `AUTENTICACAO_INVALIDA`: série, filial ou senha erradas; `LICENCA_EXPIRADA_OU_INVALIDA`: falar com a Idealsoft; `REDE`/`TEMPO_ESGOTADO`: módulo parado ou endereço errado |
| Sincronização com "ignoradas" | Configurações → Integrações → Últimos envios e erros | Normalmente vendedor do Shop9 sem vínculo com uma pessoa da Rota: ligar em Códigos por empresa → Vendedores do Shop9 |
| Orçamento com erro na Rota | Configurações → Integrações → Últimos envios e erros | A mensagem vem do Shop9 (ex.: cliente bloqueado); a Rota tenta de novo com espera progressiva até 60 min |
| Configuração inválida ao iniciar | Mensagem na tela/log | Ela diz qual campo falta |

O log **não** guarda chave, senha, série nem dados de cliente; arquivos acima de 5 MB viram `conector.log.1`.

Teste sem o Shop9 real: `npm run simulador` (sobe um Shop9 de mentira em `http://127.0.0.1:9009`, série `SIM-0001`, senha `senha-simulador`) e aponte `shop9.homologacao` para ele.
