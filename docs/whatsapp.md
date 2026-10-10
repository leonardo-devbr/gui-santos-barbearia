# Avisos pelo WhatsApp

O projeto envia confirmações, remarcações, cancelamentos e lembretes de 24 horas e 2 horas para os destinatários que aceitaram receber mensagens:

- o cliente do agendamento;
- o barbeiro responsável;
- todos os administradores ativos com telefone de notificação;
- o barbeiro anterior, somente quando o cliente troca de profissional em uma remarcação.

Os avisos ficam primeiro em uma fila no MySQL. Uma falha da Meta não desfaz o agendamento. O processador tenta novamente apenas falhas temporárias, no máximo cinco vezes, e invalida automaticamente lembretes de uma versão antiga do horário.

## Branches do projeto

- `local`: desenvolvimento e testes no computador. Use `WHATSAPP_PROVIDER=console` para gerar prévias sem enviar mensagens reais.
- `producao`: versão aprovada para a hospedagem. O serviço deve acompanhar somente essa branch e usar `WHATSAPP_PROVIDER=meta` com segredos protegidos.

O fluxo recomendado é desenvolver e testar em `local`, integrar os commits aprovados em `producao` e nunca colocar tokens em nenhuma das branches.

## Teste local sem conta da Meta

No `.env.local`, configure:

```env
WHATSAPP_PROVIDER=console
```

Depois:

1. execute `npm run db:setup` e `npm run dev`;
2. no cadastro ou perfil do cliente, marque o consentimento para os avisos;
3. no painel administrativo, abra **Acessos**, informe o telefone de notificação e habilite o WhatsApp do administrador e do barbeiro;
4. crie, remarque ou cancele um agendamento;
5. confira a prévia no terminal e o estado no painel de notificações.

O modo `console` nunca chama a Meta e registra o resultado como `previewed` (prévia), não como entregue.

Em um ambiente de homologação que usa o número de teste da Meta, é possível redirecionar todos os avisos para um único destinatário autorizado:

```env
WHATSAPP_TEST_RECIPIENT=5515999999999
```

Essa substituição é ignorada quando `NODE_ENV=production`.

## Configuração da API oficial da Meta

Use somente a WhatsApp Cloud API oficial. No painel da Meta:

1. crie ou selecione um aplicativo de negócio e adicione o produto WhatsApp;
2. registre o número que enviará as mensagens ou use o número de teste durante a homologação;
3. crie e aprove um modelo chamado `appointment_notification` em português do Brasil;
4. configure no corpo do modelo, nesta ordem, os dez parâmetros usados pelo projeto:
   1. nome do destinatário;
   2. título do aviso;
   3. contexto do destinatário;
   4. cliente;
   5. serviço;
   6. barbeiro;
   7. data;
   8. horário;
   9. valor;
   10. empresa;
5. gere um token adequado ao ambiente e mantenha-o somente no gerenciador de segredos da hospedagem.

Exemplo de configuração, sem valores reais:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_GRAPH_API_VERSION=vNN.N
WHATSAPP_PHONE_NUMBER_ID=ID_NUMERICO_DO_TELEFONE
WHATSAPP_ACCESS_TOKEN=TOKEN_PROTEGIDO
WHATSAPP_TEMPLATE_NAME=appointment_notification
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
WHATSAPP_TIMEOUT_MS=10000
```

Informe explicitamente uma versão ainda suportada da Graph API no momento da publicação. O projeto não fixa silenciosamente uma versão que poderá expirar.

## Webhook de entrega

Gere dois segredos diferentes, com pelo menos 32 caracteres:

```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=SEGREDO_DE_VERIFICACAO
WHATSAPP_APP_SECRET=APP_SECRET_DA_META
```

Na Meta, cadastre a URL HTTPS pública:

```text
https://SEU_DOMINIO/api/webhooks/whatsapp
```

Use o valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN` na verificação e assine o campo `messages`. O servidor valida a assinatura HMAC do corpo bruto antes de interpretar o JSON. A resposta inicial da Cloud API fica como `accepted`; somente o webhook altera o registro para `sent`, `delivered`, `read` ou `failed`.

Cada tentativa inclui uma referência interna opaca no campo `biz_opaque_callback_data`. Ela permite correlacionar o webhook com o item da fila sem enviar nome, telefone, e-mail ou outro dado pessoal nesse campo.

Timeout, erro HTTP `5xx` e resposta `2xx` sem um identificador de mensagem válido são resultados ambíguos: a Meta pode ter aceitado o envio mesmo sem o servidor receber a confirmação. Nesses casos, a fila aguarda por pelo menos cinco minutos por um webhook antes de permitir uma nova tentativa.

## Processador e agendamento automático

Configure um `CRON_SECRET` exclusivo com pelo menos 32 caracteres. O agendador deve fazer um `POST` a cada cinco minutos para:

```text
/api/notifications/process
```

com o cabeçalho:

```text
Authorization: Bearer VALOR_DO_CRON_SECRET
```

Localmente, com o site em execução, o mesmo processamento pode ser disparado por:

```powershell
npm run notifications:process
```

O envio imediato após uma alteração é apenas uma otimização. A fila e o agendador são a garantia de processamento dos lembretes e novas tentativas.

O processamento usa semântica *at-least-once*: prioriza não perder um aviso e reduz duplicidades por meio da correlação e do período de espera, mas uma falha de rede em um momento crítico ainda pode gerar uma duplicidade rara. O painel **Notificações** permite acompanhar tentativas, estados e falhas; o cron também reconcilia confirmações pendentes e executa as tentativas liberadas após a espera.

## Consentimento e segurança

- O consentimento começa desmarcado e pode ser revogado no perfil.
- Antes de cada tentativa, o sistema revalida consentimento, telefone, conta ativa, profissional e versão do agendamento.
- Tokens, `APP_SECRET`, `CRON_SECRET` e telefones completos não devem aparecer em logs, commits ou capturas de tela.
- Mensagens iniciadas pela empresa usam um modelo aprovado. Um agendamento feito no site não abre, por si só, uma janela de atendimento livre de 24 horas no WhatsApp.
- Solicitações de descadastro também devem ser respeitadas operacionalmente, além do botão disponível no perfil.

Consulte sempre a [Política de Mensagens do WhatsApp Business](https://business.whatsapp.com/policy/preview?lang=pt_BR) e a [documentação oficial da WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) antes de ativar o ambiente real.
