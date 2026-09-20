# Gui Santos Barbearia

Site, área do cliente e painel administrativo para a gestão de horários da Gui Santos Barbearia.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS 4
- Base UI e Lucide Icons
- MySQL 8 para persistência de clientes, sessões, catálogo e agendamentos
- Nodemailer e SMTP para e-mails transacionais
- Vitest, React Testing Library e MySQL isolado para testes automatizados

## Como rodar o projeto localmente

Cada desenvolvedor terá seu próprio banco local. O banco e as senhas não são enviados ao GitHub; somente o schema e os dados iniciais ficam versionados.

### 1. Instalar os requisitos

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) 20.19 ou superior, com npm
- [MySQL Community Server 8](https://dev.mysql.com/downloads/installer/)

Durante a instalação do MySQL, mantenha a porta `3306`, crie uma senha para o usuário `root` e guarde essa senha. O MySQL Workbench é opcional.

Para conferir as instalações no PowerShell:

```powershell
git --version
node --version
npm --version
```

### 2. Clonar o repositório

```powershell
git clone https://github.com/leonardo-devbr/gui-santos-barbearia.git
cd gui-santos-barbearia
```

### 3. Instalar as dependências

```powershell
npm install
```

### 4. Criar a configuração local

Copie o arquivo de exemplo:

```powershell
Copy-Item .env.example .env.local
```

Abra `.env.local` e substitua somente a senha:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD="SENHA_CRIADA_NA_INSTALACAO"
MYSQL_DATABASE=gui_santos_barbearia
MYSQL_SSL=false
```

Não remova as aspas da senha e nunca envie `.env.local` ao GitHub.

### 5. Criar o banco, as tabelas e os dados iniciais

Com o serviço do MySQL em execução:

```powershell
npm run db:setup
```

O resultado esperado é:

```text
Banco gui_santos_barbearia preparado com sucesso.
```

Esse comando pode ser executado novamente com segurança. Ele mantém clientes, agendamentos e personalizações existentes, aplica as migrações conhecidas e insere somente os dados iniciais que ainda não existem. Serviços e barbeiros editados ou desativados no painel não são sobrescritos.

Em um servidor, o comando também pode usar uma credencial temporária com permissão para criar ou alterar tabelas. Defina `MYSQL_SETUP_USER` e `MYSQL_SETUP_PASSWORD`, execute `db:setup` e depois remova essas duas variáveis do ambiente da aplicação. O site continuará usando `MYSQL_USER` e `MYSQL_PASSWORD` normalmente.

### 6. Criar o primeiro administrador

Depois de executar `db:setup`, acrescente temporariamente estas variáveis ao final do `.env.local`:

```env
ADMIN_NAME="Nome do administrador"
ADMIN_EMAIL="admin@seudominio.com"
ADMIN_PASSWORD="uma-senha-forte-com-12-ou-mais-caracteres-e-1-numero"
```

A senha deve ter entre 12 e 128 caracteres, com pelo menos uma letra e um número. Em seguida, execute:

```powershell
npm run admin:create
```

O comando pode ser repetido para atualizar o nome ou a senha do mesmo e-mail. Depois da criação, remova `ADMIN_PASSWORD` do `.env.local`; a senha já estará armazenada no MySQL somente como hash.

Não existe cadastro público de administradores. Cada ambiente local ou servidor precisa executar esse comando ao menos uma vez para obter acesso ao painel.

### 7. Configurar e-mails e lembretes (opcional localmente)

O site funciona localmente sem um provedor de e-mail. Mantenha `SMTP_HOST` e `SMTP_FROM` vazios para que as mensagens sejam exibidas como prévias no terminal, sem envio real.

Para enviar mensagens de verdade, configure no `.env.local` as credenciais SMTP fornecidas pelo seu provedor:

```env
APP_URL=http://localhost:3000
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-usuario
SMTP_PASSWORD="sua-senha-ou-chave-de-aplicativo"
SMTP_FROM="Gui Santos Barbearia <nao-responda@seudominio.com>"
```

Use `SMTP_SECURE=true` com a porta `465`; na porta `587`, mantenha `false` para exigir STARTTLS. Conexões SMTP usam no mínimo TLS 1.2 e validam o certificado do servidor. Quando o provedor oferecer senha de aplicativo, use-a no lugar da senha normal da conta.

Os lembretes e as novas tentativas de envio exigem um segredo. Gere um valor aleatório:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para o `.env.local`. O segredo precisa ter pelo menos 32 caracteres:

```env
CRON_SECRET="valor-aleatorio-gerado"
```

### 8. Iniciar o site

```powershell
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O painel usa um login separado em [http://localhost:3000/admin/login](http://localhost:3000/admin/login). Para encerrar o servidor, volte ao terminal e pressione `Ctrl + C`.

### 9. Processar lembretes e novas tentativas

Com o site em execução e `CRON_SECRET` configurado, abra outro terminal na pasta do projeto e execute:

```powershell
npm run notifications:process
```

O comando cria um lembrete para cada atendimento do dia seguinte, evita duplicações e tenta novamente mensagens pendentes ou com falha, até o limite de três tentativas.

Em produção, configure o agendador da hospedagem para fazer uma requisição `POST` diária a `/api/notifications/process`, enviando o cabeçalho `Authorization: Bearer VALOR_DO_CRON_SECRET`. O segredo deve existir tanto no ambiente do site quanto no agendador.

## Testes automatizados

Com o serviço local do MySQL em execução e o `.env.local` configurado, rode toda a suíte:

```powershell
npm test
```

Para repetir os testes automaticamente durante o desenvolvimento:

```powershell
npm run test:watch
```

A suíte cobre validações, datas, templates de e-mail, limites de corpo da API, a confirmação de e-mail no navegador e as regras críticas de agendamento. Os testes de integração criam um banco temporário com o prefixo `gui_santos_barbearia_test_`, aplicam o schema real e removem esse banco ao terminar. Eles nunca reutilizam nem apagam o banco definido em `MYSQL_DATABASE` e, por segurança, só executam essa criação em um MySQL local.

O usuário configurado precisa ter permissão para criar e remover o banco temporário. Se a aplicação usa uma conta restrita, defina `MYSQL_SETUP_USER` e `MYSQL_SETUP_PASSWORD` somente no ambiente local de testes. Nunca execute a suíte com credenciais de produção.

No GitHub, cada push e pull request prepara uma instância isolada do MySQL 8.4 e executa schema, lint, verificação de tipos, testes e build automaticamente.

### Preparação para produção

Antes de publicar o site:

- use HTTPS e configure `APP_URL` somente com a origem pública, por exemplo `https://barbearia.exemplo.com`, sem caminho adicional;
- use um usuário MySQL exclusivo da aplicação, com acesso somente ao banco do projeto e sem permissões administrativas globais;
- defina `MYSQL_SSL=true` quando o MySQL estiver em outro servidor; se o provedor fornecer uma autoridade certificadora própria, informe o certificado PEM em base64 por `MYSQL_SSL_CA_BASE64`;
- guarde senhas e segredos nas variáveis protegidas da hospedagem, nunca em um arquivo enviado ao GitHub;
- configure SMTP com TLS, um remetente do domínio e credenciais exclusivas da aplicação;
- configure `TRUSTED_PROXY_IP_HEADER` com o cabeçalho de IP garantido pela hospedagem (`cf-connecting-ip`, `x-real-ip` ou `x-forwarded-for`); nunca confie em um cabeçalho que chega diretamente da internet;
- gere um `CRON_SECRET` longo e diferente das demais senhas;
- mantenha `DEV_EXPOSE_PASSWORD_RESET_URL=false` e `DEV_EXPOSE_EMAIL_VERIFICATION_URL=false`, e remova `ADMIN_PASSWORD`, `MYSQL_SETUP_USER` e `MYSQL_SETUP_PASSWORD` depois das tarefas de configuração.

Em produção, `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_DATABASE` devem ser definidos explicitamente, a senha não pode ficar vazia e `MYSQL_USER` não pode ser `root`. A aplicação recusa uma conexão remota sem TLS; bancos locais em `localhost` ou `127.0.0.1` continuam funcionando com `MYSQL_SSL=false` durante o desenvolvimento.

### Atualizando uma cópia já existente

Depois que outro desenvolvedor enviar alterações ao repositório:

```powershell
git pull origin main
npm install
npm run db:setup
npm run dev
```

Executar `npm install` e `npm run db:setup` após o `git pull` garante que novas dependências e alterações no banco sejam aplicadas localmente.

### Erros comuns

- `Access denied for user 'root'`: a senha em `.env.local` não corresponde à senha do MySQL.
- `ECONNREFUSED 127.0.0.1:3306`: o serviço do MySQL não está iniciado ou está usando outra porta.
- `EADDRINUSE`: a porta do site já está ocupada; encerre o outro processo ou abra a porta alternativa mostrada pelo Next.js.
- `npm.ps1 cannot be loaded`: use `npm.cmd` no lugar de `npm` ou ajuste a política de execução do PowerShell.

### Validação antes de enviar alterações

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Estado da integração

O backend usa Route Handlers do Next.js e MySQL. Cadastro, login, logout, perfil, catálogo, disponibilidade, criação, remarcação, cancelamento e histórico de agendamentos estão conectados ao banco. O painel administrativo também usa o MySQL para autenticação da equipe, indicadores, agenda diária, bloqueios, catálogo, equipe e configurações do estabelecimento.

As senhas usam derivação `scrypt` e novas senhas exigem ao menos 12 caracteres, uma letra e um número. Uma conta só pode entrar depois de comprovar a posse do e-mail. Sessões e tokens de recuperação ou confirmação ficam no MySQL somente como hashes, enquanto o navegador recebe apenas um cookie de sessão `HttpOnly`, `SameSite=Lax` e seguro em produção. Sessões antigas são limitadas e rotacionadas durante novos logins. A confirmação de um horário ocorre dentro de uma transação que bloqueia os recursos necessários e verifica novamente qualquer sobreposição.

Recuperação de senha, verificação de endereço, confirmação, remarcação, cancelamento e lembrete de agendamento possuem e-mails próprios. Sem SMTP, o desenvolvimento mostra uma prévia no terminal. Links só aparecem diretamente na tela local com as opções explícitas `DEV_EXPOSE_PASSWORD_RESET_URL` ou `DEV_EXPOSE_EMAIL_VERIFICATION_URL`; isso nunca ocorre em produção. Em produção, `APP_URL` com HTTPS e as credenciais SMTP são obrigatórios para a entrega real.

As notificações de agendamento são registradas em uma fila no MySQL. Uma indisponibilidade do provedor de e-mail não desfaz o agendamento: a mensagem fica marcada como falha e o processador pode tentar novamente até três vezes.
O processador também elimina, em lotes, notificações concluídas ou abandonadas há mais de 90 dias, evitando manter indefinidamente destinatários e cópias do conteúdo enviado.

A API rejeita origens incompatíveis em operações que alteram dados, limita o corpo JSON, aplica limites de tentativas em autenticação e agenda e envia cabeçalhos de segurança no navegador. Trocar o e-mail do cliente ou gerenciar contas administrativas exige confirmar a senha atual.

Todas as requisições e respostas usam JSON. Em erros, a API responde com um status HTTP adequado e, sempre que possível, com este formato:

```json
{
  "message": "Mensagem legível para o cliente.",
  "errors": {
    "email": "Mensagem específica do campo."
  }
}
```

`errors` é opcional. Os nomes dos campos devem corresponder aos payloads descritos abaixo.

## API implementada

### Autenticação

| Método | Rota | Corpo | Comportamento |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `{ "name", "phone", "email", "password" }` | Inicia o cadastro e envia um link de confirmação sem revelar se o e-mail já está em uso. |
| `POST` | `/api/auth/login` | `{ "email", "password" }` | Cria a sessão e envia um cookie seguro e `HttpOnly`. |
| `POST` | `/api/auth/logout` | Sem corpo | Invalida a sessão e remove o cookie. |
| `POST` | `/api/auth/forgot-password` | `{ "email" }` | Cria um token sem revelar se o e-mail existe; só devolve o link local com a opção explícita de desenvolvimento. |
| `POST` | `/api/auth/reset-password` | `{ "token", "password" }` | Consome um token válido e altera a senha. |
| `POST` | `/api/auth/verify-email` | `{ "token" }` | Ativa um cadastro ou confirma a troca de e-mail. |

O link de recuperação aponta para `/redefinir-senha?token=TOKEN`, expira em uma hora e é invalidado após o uso. A confirmação de e-mail aponta para `/verificar-email?token=TOKEN` e expira em 24 horas. Ambos os tokens são aleatórios e armazenados somente como hash.

### Agendamentos

`GET /api/availability?serviceId=ID&barberId=ID&date=YYYY-MM-DD`

Resposta de sucesso:

```json
{
  "slots": [
    { "time": "09:00", "available": true },
    { "time": "09:30", "available": false }
  ]
}
```

| Método | Rota | Corpo | Comportamento |
| --- | --- | --- | --- |
| `POST` | `/api/appointments` | `{ "serviceId", "barberId", "date", "time" }` | Cria um agendamento para o cliente autenticado. |
| `PATCH` | `/api/appointments/:id` | `{ "serviceId", "barberId", "date", "time" }` | Remarca um agendamento pertencente ao cliente autenticado. |
| `DELETE` | `/api/appointments/:id` | Sem corpo | Cancela um agendamento pertencente ao cliente autenticado. |

A disponibilidade exibida no navegador é apenas informativa. Ao criar ou remarcar, o backend valida novamente o horário dentro de uma transação para impedir dois agendamentos simultâneos para o mesmo barbeiro e horários sobrepostos para o mesmo cliente. Cada cliente pode manter até cinco agendamentos futuros ativos, e os horários são liberados com no máximo 90 dias de antecedência. Reenviar uma remarcação sem mudanças não gera uma notificação duplicada.

### Notificações

| Método | Rota | Autorização | Comportamento |
| --- | --- | --- | --- |
| `POST` | `/api/notifications/process` | `Bearer CRON_SECRET` | Cria os lembretes do dia seguinte e processa a fila pendente, em lotes de até 50 mensagens. |

Essa rota é destinada ao agendador do servidor e nunca deve ser chamada a partir do navegador do cliente. Repetir a execução não duplica os lembretes já criados.

### Administração

Clientes e administradores possuem contas, sessões, cookies e telas de login independentes. As rotas abaixo exigem uma sessão administrativa válida:

| Método | Rota | Corpo | Comportamento |
| --- | --- | --- | --- |
| `POST` | `/api/admin/auth/login` | `{ "email", "password" }` | Inicia uma sessão administrativa. |
| `POST` | `/api/admin/auth/logout` | Sem corpo | Encerra a sessão administrativa. |
| `GET` | `/api/admin/appointments?date=YYYY-MM-DD` | Sem corpo | Lista a agenda completa da data, incluindo os dados do cliente. |
| `PATCH` | `/api/admin/appointments/:id` | `{ "status" }` | Marca um atendimento como `concluido` ou `cancelado`. |
| `POST` | `/api/admin/schedule-blocks` | Dados do período | Bloqueia um dia ou intervalo para um barbeiro ou toda a equipe. |
| `DELETE` | `/api/admin/schedule-blocks/:id` | Sem corpo | Remove um bloqueio futuro. |
| `POST` | `/api/admin/services` | Dados do serviço | Cria um serviço com preço, duração e categoria. |
| `PATCH` | `/api/admin/services/:id` | Dados do serviço | Edita ou ativa/desativa um serviço. |
| `POST` | `/api/admin/barbers` | Dados do barbeiro | Cria um perfil profissional. |
| `PATCH` | `/api/admin/barbers/:id` | Dados do barbeiro | Edita ou ativa/desativa um barbeiro. |
| `PATCH` | `/api/admin/business` | Dados do estabelecimento | Atualiza contato, endereço e localização. |
| `PUT` | `/api/admin/business-hours` | `{ "hours": [...] }` | Atualiza os sete dias de funcionamento. |
| `POST` | `/api/admin/users` | `{ "name", "email", "password", "currentPassword" }` | Cria outro administrador após confirmar a senha do administrador atual. |
| `PATCH` | `/api/admin/users/:id` | Dados da conta e `currentPassword` | Edita, redefine a senha ou desativa um administrador após confirmar a senha atual. |

No navegador, o painel possui as seguintes áreas:

- `/admin`: indicadores e agenda de hoje;
- `/admin/agendamentos`: consulta da agenda por data;
- `/admin/bloqueios`: folgas, pausas, feriados e indisponibilidades;
- `/admin/servicos`: serviços, preços, duração e disponibilidade;
- `/admin/barbeiros`: perfis e disponibilidade da equipe;
- `/admin/configuracoes`: contato, endereço, mapa e horários de funcionamento;
- `/admin/administradores`: contas administrativas e redefinição de acesso.

Serviços e barbeiros são desativados, não apagados, preservando o histórico dos agendamentos. Horários e bloqueios são validados novamente pelo backend ao criar ou remarcar uma reserva. O administrador atual não pode desativar a própria conta, e a troca de senha invalida sessões anteriores.

### Perfil

`PATCH /api/customers/me`

```json
{
  "name": "João Pedro",
  "phone": "11987654321",
  "email": "joao@email.com",
  "birthDate": "1994-03-12",
  "preferredCut": "Degradê médio",
  "beardStyle": "Barba média",
  "notes": "Prefere acabamento natural."
}
```

Essa rota exige autenticação e só pode alterar o perfil vinculado à sessão atual.
Ao solicitar a troca do e-mail, envie também `currentPassword`. O endereço atual permanece válido até a confirmação do novo endereço; depois da confirmação, todas as sessões são revogadas e o cliente precisa entrar novamente.

### Leituras

- `GET /api/customers/me`
- `GET /api/services`
- `GET /api/barbers`
- `GET /api/appointments`
- `GET /api/appointments?scope=history`

## Regras do backend MySQL

- Nunca armazenar senhas ou tokens de recuperação em texto puro.
- Normalizar e garantir a unicidade do e-mail.
- Validar todos os payloads também no servidor; a validação do navegador é apenas de experiência de uso.
- Exigir autenticação nas rotas de perfil, disponibilidade privada e agendamentos.
- Manter autenticação e cookies administrativos separados das contas dos clientes.
- Impedir reservas que coincidam com bloqueios administrativos de agenda.
- Proteger o processador de notificações com um segredo exclusivo do ambiente.
- Verificar se o agendamento pertence ao cliente antes de remarcar ou cancelar.
- Usar transação e bloqueio adequado ao confirmar horários, considerando a duração do serviço.
- Retornar `401` para sessão ausente/inválida, `403` para acesso indevido, `404` para recurso inexistente, `409` para conflito de horário e `422` para dados inválidos.
