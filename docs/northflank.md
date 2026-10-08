# Homologação gratuita no Northflank

Este guia publica a aplicação Next.js e um MySQL privado no plano **Developer Sandbox**. Esse plano é indicado para homologação e testes, não para o uso definitivo da barbearia.

O repositório não contém senhas. Todas as credenciais abaixo devem ser cadastradas como variáveis protegidas no Northflank.

## 1. Criar o projeto

1. Crie uma conta em [app.northflank.com](https://app.northflank.com/signup) e conecte o GitHub.
2. Selecione o plano **Developer Sandbox** e mantenha somente recursos marcados como gratuitos.
3. Crie um projeto na região disponível mais próxima dos usuários.

O Northflank exige um cartão para verificar a conta. O cartão não é cobrado no cadastro, mas confirme que o projeto continua no plano Sandbox antes de criar qualquer recurso.

## 2. Criar o MySQL

Crie um addon com estas opções:

- tipo: **MySQL**;
- versão: **8.4**;
- nome sugerido: `barbearia-mysql`;
- TLS: **ativado**;
- acesso público: **desativado**;
- nome personalizado do banco: `gui_santos_barbearia`.

O nome personalizado fica nas opções avançadas e não pode ser alterado depois da criação.

## 3. Criar os segredos da aplicação

Crie um grupo de segredos de runtime, selecione o addon MySQL e associe os valores usando estes aliases:

| Segredo do addon | Variável da aplicação |
| --- | --- |
| `HOST` | `MYSQL_HOST` |
| `PORT` | `MYSQL_PORT` |
| `USERNAME` | `MYSQL_USER` |
| `PASSWORD` | `MYSQL_PASSWORD` |
| `DATABASE` | `MYSQL_DATABASE` |

Adicione também:

```env
MYSQL_SSL=true
MYSQL_CREATE_DATABASE=false
MYSQL_CONNECTION_LIMIT=5
TRUSTED_PROXY_IP_HEADER=x-forwarded-for
DEV_EXPOSE_PASSWORD_RESET_URL=false
DEV_EXPOSE_EMAIL_VERIFICATION_URL=false
GOOGLE_MAPS_EMBED_API_KEY=sua-chave-restrita-da-maps-embed-api
CRON_SECRET=gere-um-valor-aleatorio-com-pelo-menos-32-caracteres
```

Não defina `MYSQL_SETUP_USER` ou `MYSQL_SETUP_PASSWORD` na aplicação. O usuário normal do addon é suficiente para preparar as tabelas dentro do banco já criado.
Restrinja `GOOGLE_MAPS_EMBED_API_KEY` no Google Cloud à URL pública do serviço antes de disponibilizar o ambiente de homologação.

## 4. Criar o serviço web

Crie um serviço **Combined** com:

- repositório: `leonardo-devbr/gui-santos-barbearia`;
- branch: `producao`;
- build: **Dockerfile**;
- contexto: raiz do repositório;
- Dockerfile: `/Dockerfile`;
- uma instância no plano gratuito;
- grupo de segredos criado anteriormente;
- porta pública HTTP `3000`.

O serviço receberá uma URL HTTPS no domínio `code.run`. Depois do primeiro deploy, adicione essa origem ao grupo de segredos, sem barra no final:

```env
APP_URL=https://endereco-gerado.code.run
```

Salve a variável e faça um novo deploy.

Configure as verificações da porta `3000`:

| Tipo | Caminho | Intervalo | Timeout | Falhas |
| --- | --- | --- | --- | --- |
| Startup | `/api/health/live` | 10 s | 3 s | 12 |
| Liveness | `/api/health/live` | 30 s | 3 s | 3 |
| Readiness | `/api/health/ready` | 10 s | 3 s | 3 |

O liveness verifica somente o processo. O readiness consulta o MySQL sem devolver detalhes da conexão.

## 5. Preparar as tabelas

Crie um job manual usando a mesma imagem gerada pelo serviço e o mesmo grupo de segredos. Use este comando:

```text
node scripts/setup-database.mjs
```

Execute o job uma vez. O log esperado termina com:

```text
Banco gui_santos_barbearia preparado com sucesso.
```

O comando é idempotente e pode ser executado novamente depois de atualizações de schema.

## 6. Criar contas de homologação

Para testar cliente, administrador e barbeiro sem depender de SMTP, crie um job manual temporário com o comando:

```text
node scripts/seed-test-users.mjs
```

Além dos segredos do MySQL, configure no job:

```env
SEED_TEST_USERS=true
SEED_CUSTOMER_NAME=Cliente de Teste
SEED_CUSTOMER_PHONE=11999999999
SEED_CUSTOMER_EMAIL=escolha-um-email
SEED_CUSTOMER_PASSWORD=escolha-uma-senha-forte
SEED_ADMIN_NAME=Administrador de Teste
SEED_ADMIN_EMAIL=escolha-outro-email
SEED_ADMIN_PASSWORD=escolha-outra-senha-forte
SEED_BARBER_NAME=Barbeiro de Teste
SEED_BARBER_EMAIL=escolha-outro-email
SEED_BARBER_PASSWORD=escolha-outra-senha-forte
SEED_BARBER_ID=guilherme
```

As senhas precisam ter de 12 a 128 caracteres, com pelo menos uma letra e um número. Execute uma vez e depois **remova todas as variáveis `SEED_*` e exclua ou desative esse job**. As senhas são gravadas somente como hash.

## 7. E-mails, WhatsApp e notificações

O cadastro público exige SMTP em produção. Até configurar um provedor, use apenas a conta de cliente criada pelo job de homologação.

Quando houver SMTP, acrescente ao serviço:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Para testar somente as prévias na homologação, configure `WHATSAPP_PROVIDER=console`. Para envio real, cadastre como segredos as variáveis `WHATSAPP_*` descritas em [whatsapp.md](whatsapp.md), use `WHATSAPP_PROVIDER=meta` e registre no painel da Meta o webhook público `https://endereco-gerado.code.run/api/webhooks/whatsapp`.

Para processar lembretes, reutilize o job temporário das contas ou crie um dos jobs gratuitos com:

```text
node scripts/process-notifications.mjs
```

Esse job precisa somente de `APP_URL` e do mesmo `CRON_SECRET` usado pelo serviço. Agende uma execução a cada cinco minutos para atender também aos lembretes de 2 horas e às novas tentativas do WhatsApp.

## 8. Verificação

Depois do setup, confirme:

1. `/api/health/live` responde `200`;
2. `/api/health/ready` responde `200`;
3. a página inicial carrega serviços e barbeiros;
4. as três contas conseguem entrar;
5. um cliente consegue criar um agendamento;
6. o barbeiro enxerga somente a própria agenda;
7. o administrador enxerga todas as agendas;
8. a confirmação aparece em `/admin/notificacoes` como prévia ou aceita;
9. no modo Meta, o webhook atualiza o estado para enviada, entregue ou lida.

Os logs nunca devem mostrar valores de `MYSQL_PASSWORD`, `CRON_SECRET`, senhas de contas, telefones completos, credenciais SMTP ou segredos `WHATSAPP_*`.
