# Gui Santos Barbearia

Site e área do cliente para cadastro, autenticação e agendamento de horários da Gui Santos Barbearia.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS 4
- Base UI e Lucide Icons
- MySQL 8 para persistência de clientes, sessões, catálogo e agendamentos

## Como rodar o projeto localmente

Cada desenvolvedor terá seu próprio banco local. O banco e as senhas não são enviados ao GitHub; somente o schema e os dados iniciais ficam versionados.

### 1. Instalar os requisitos

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) 20.9 ou superior, com npm
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

Esse comando pode ser executado novamente com segurança. Ele mantém clientes e agendamentos existentes e atualiza o catálogo inicial de serviços e barbeiros.

### 6. Iniciar o site

```powershell
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Para encerrar o servidor, volte ao terminal e pressione `Ctrl + C`.

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
npm run build
```

## Estado da integração

O backend usa Route Handlers do Next.js e MySQL. Cadastro, login, logout, perfil, catálogo, disponibilidade, criação, remarcação, cancelamento e histórico de agendamentos estão conectados ao banco.

As senhas usam derivação `scrypt`. Sessões e tokens de recuperação ficam no MySQL, enquanto o navegador recebe apenas um cookie de sessão `HttpOnly`. A confirmação de um horário ocorre dentro de uma transação que bloqueia o barbeiro selecionado e verifica novamente qualquer sobreposição.

Durante o desenvolvimento, a recuperação de senha mostra o link local na própria tela e no terminal. Em produção, o token continua sendo criado com segurança, mas será necessário conectar um serviço de envio de e-mail para entregar o link ao cliente.

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
| `POST` | `/api/auth/register` | `{ "name", "phone", "email", "password" }` | Cria a conta; e-mail deve ser único. |
| `POST` | `/api/auth/login` | `{ "email", "password" }` | Cria a sessão e envia um cookie seguro e `HttpOnly`. |
| `POST` | `/api/auth/logout` | Sem corpo | Invalida a sessão e remove o cookie. |
| `POST` | `/api/auth/forgot-password` | `{ "email" }` | Cria um token sem revelar se o e-mail existe; em desenvolvimento, devolve o link local. |
| `POST` | `/api/auth/reset-password` | `{ "token", "password" }` | Consome um token válido e altera a senha. |

O link de recuperação aponta para `/redefinir-senha?token=TOKEN`. O token é aleatório, armazenado somente como hash, expira em uma hora e é invalidado após o uso.

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

A disponibilidade exibida no navegador é apenas informativa. Ao criar ou remarcar, o backend valida novamente o horário dentro de uma transação para impedir dois agendamentos simultâneos para o mesmo barbeiro.

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
- Verificar se o agendamento pertence ao cliente antes de remarcar ou cancelar.
- Usar transação e bloqueio adequado ao confirmar horários, considerando a duração do serviço.
- Retornar `401` para sessão ausente/inválida, `403` para acesso indevido, `404` para recurso inexistente, `409` para conflito de horário e `422` para dados inválidos.
