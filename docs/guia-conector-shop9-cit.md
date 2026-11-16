# Conector Shop9 — guia de instalação (TI)

O conector é um programa pequeno que roda **no computador onde está o módulo Integrações do Shop9**. Ele conversa com o Shop9 pela rede local e com a Rota pela internet, **só por conexões de saída HTTPS**. Nenhuma porta é aberta para a internet.

```
Shop9 (Integrações) ←rede local→ Conector ──HTTPS saída 443──→ Rota
```

Este arquivo não contém senhas nem tokens. Nunca cole credenciais em chamados, e-mails ou no repositório.

## 1. Requisitos do computador
- Windows 10/11 ou Windows Server, **sempre ligado** (sem suspensão nem hibernação; desative em Opções de energia).
- Node.js **22 LTS** (22.12 ou mais novo), instalado para todos os usuários: <https://nodejs.org>. O conector não usa nenhuma biblioteca externa.
- Acesso ao módulo Integrações do Shop9 (endereço local, série e senha fornecidos pela Idealsoft).
- Saída para a internet na porta 443.

## 2. Instalação
1. Copie a pasta `conector-shop9` para `C:\Program Files\ConectorShop9\0.1.0\`.
2. Crie `C:\ProgramData\ConectorShop9\` e copie para lá `config.exemplo.json` com o nome `config.json`.
3. Na Rota, um **administrador** abre Configurações → Integrações → Shop9 → **Gerar token**. O token aparece **uma única vez**: copie direto para o `config.json` (campo `token`) junto com o `conector_id` mostrado. Se perder, gere outro (o anterior deixa de valer).
4. Preencha no `config.json`: `rota_url` (sempre `https://`), `filiais` (id de cada empresa na Rota → código da filial no Shop9) e `shop9.homologacao`/`shop9.producao` (endereço local, série, senha).
5. Proteja o arquivo (PowerShell como administrador):
   ```powershell
   icacls "C:\ProgramData\ConectorShop9" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administradores:(OI)(CI)F"
   ```
   Só o sistema (que roda o serviço) e administradores leem a pasta.
   Alternativa: em vez de gravar no arquivo, defina as variáveis de ambiente `CONECTOR_TOKEN` e `SHOP9_SENHA` só para a tarefa do serviço; elas têm prioridade.
6. Teste manual: `node "C:\Program Files\ConectorShop9\0.1.0\src\servico.js"`. Em até 1 minuto a Rota mostra **Online** e a versão. Pare com Ctrl+C.

## 3. Rodar como serviço (Agendador de Tarefas, sem instalar nada)
PowerShell como administrador:
```powershell
$acao = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument '"C:\Program Files\ConectorShop9\atual\src\servico.js"'
$gatilho = New-ScheduledTaskTrigger -AtStartup
$conf = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName "ConectorShop9" -Action $acao -Trigger $gatilho -Settings $conf -User "SYSTEM" -RunLevel Highest
New-Item -ItemType Junction -Path "C:\Program Files\ConectorShop9\atual" -Target "C:\Program Files\ConectorShop9\0.1.0"
Start-ScheduledTask -TaskName "ConectorShop9"
```
A tarefa sobe com o Windows, sem ninguém logado, e reinicia sozinha se cair.

## 4. Firewall
- **Entrada:** nenhuma regra nova. O conector não escuta porta nenhuma.
- **Saída:** liberar só HTTPS (TCP 443) para o endereço da Rota, e a porta do módulo Integrações na rede local.

## 5. Atualização segura
1. Baixe a nova versão só do repositório oficial e confira o SHA-256 informado na publicação (`Get-FileHash arquivo.zip`).
2. Extraia em uma pasta nova (`...\ConectorShop9\0.2.0\`), sem apagar a anterior.
3. `Stop-ScheduledTask ConectorShop9`, aponte a junção `atual` para a nova pasta, `Start-ScheduledTask ConectorShop9`.
4. Confira na Rota a versão nova e **Online**. Deu problema: aponte `atual` de volta para a pasta anterior e reinicie.

O `config.json` e o `estado.json` (posição da sincronização) ficam em `C:\ProgramData\ConectorShop9` e não mudam na atualização.

## 6. Diagnóstico
| Sintoma | Onde olhar | O que fazer |
| --- | --- | --- |
| Rota mostra **Offline** | `C:\ProgramData\ConectorShop9\logs\conector.log` | Ver se a tarefa está rodando (`Get-ScheduledTask ConectorShop9`), internet e relógio do Windows (diferença acima de 5 min é recusada) |
| Log com `status: 401` | — | Token revogado ou trocado: gere outro na Rota e atualize o `config.json` |
| Log com `shop9_indisponivel` | — | Módulo Integrações parado, endereço/série/senha errados ou ambiente sem credenciais |
| Orçamento com erro na Rota | Configurações → Integrações → Últimos envios e erros | A mensagem vem do Shop9 (ex.: cliente bloqueado); a Rota tenta de novo com espera progressiva até 60 min |
| Configuração inválida ao iniciar | Mensagem na tela/log | Ela diz qual campo falta |

O log **não** guarda token, senha, série nem dados de cliente; arquivos acima de 5 MB viram `conector.log.1`.

Teste sem o Shop9 real: `npm run simulador` (sobe um Shop9 de mentira em `http://127.0.0.1:9009`, série `SIM-0001`, senha `senha-simulador`) e aponte `shop9.homologacao` para ele.
