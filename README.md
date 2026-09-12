# Gui Santos Barbearia

Site e área do cliente para cadastro, autenticação e agendamento de horários da Gui Santos Barbearia.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS 4
- Base UI e Lucide Icons
- MySQL 8 para persistência de clientes, sessões, catálogo e agendamentos

## Executando localmente

Requisitos: Node.js 20.9 ou superior, npm e MySQL 8.

Instale as dependências e crie a configuração local:

```powershell
npm install
Copy-Item .env.example .env.local
```

Edite `.env.local` e informe a senha definida na instalação do MySQL. Em seguida, crie as tabelas e carregue o catálogo inicial:

```powershell
npm run db:setup
npm run dev
```

O comando `db:setup` é idempotente: ele cria o banco `gui_santos_barbearia`, mantém dados existentes e atualiza os serviços e barbeiros iniciais. O projeto ficará disponível em `http://localhost:3000`.

As variáveis disponíveis são:

| Variável | Padrão |
| --- | --- |
| `MYSQL_HOST` | `127.0.0.1` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | `root` |
| `MYSQL_PASSWORD` | sem valor padrão |
| `MYSQL_DATABASE` | `gui_santos_barbearia` |

O arquivo `.env.local` não é versionado. Em produção, use um usuário próprio da aplicação com acesso somente ao banco do projeto.

Antes de publicar uma mudança, execute:

```bash
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
