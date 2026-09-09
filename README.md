# Gui Santos Barbearia

Site e área do cliente para cadastro, autenticação e agendamento de horários da Gui Santos Barbearia.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS 4
- Base UI e Lucide Icons
- MySQL planejado para a persistência do backend

## Executando localmente

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

O projeto ficará disponível em `http://localhost:3000`.

Antes de publicar uma mudança, execute:

```bash
npm run lint
npm run typecheck
npm run build
```

## Estado da integração

Os formulários e ações de escrita já usam HTTP, mas as leituras de clientes, serviços, barbeiros e agendamentos ainda vêm dos arquivos em `data/`. Esses dados são temporários e deverão ser substituídos pelas consultas ao backend quando a integração com MySQL for iniciada.

Todas as requisições e respostas usam JSON. Em erros, a API deve responder com um status HTTP adequado e, sempre que possível, com este formato:

```json
{
  "message": "Mensagem legível para o cliente.",
  "errors": {
    "email": "Mensagem específica do campo."
  }
}
```

`errors` é opcional. Os nomes dos campos devem corresponder aos payloads descritos abaixo.

## Contrato da API

### Autenticação

| Método | Rota | Corpo | Comportamento esperado |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `{ "name", "phone", "email", "password" }` | Cria a conta; e-mail deve ser único. |
| `POST` | `/api/auth/login` | `{ "email", "password" }` | Cria a sessão e envia um cookie seguro e `HttpOnly`. |
| `POST` | `/api/auth/logout` | Sem corpo | Invalida a sessão e remove o cookie. |
| `POST` | `/api/auth/forgot-password` | `{ "email" }` | Envia um link de recuperação sem revelar se o e-mail existe. |
| `POST` | `/api/auth/reset-password` | `{ "token", "password" }` | Consome um token válido e altera a senha. |

O link enviado por e-mail deve apontar para `/redefinir-senha?token=TOKEN`. Tokens de recuperação precisam ser aleatórios, armazenados de forma segura, ter expiração curta e ser invalidados após o uso.

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

| Método | Rota | Corpo | Comportamento esperado |
| --- | --- | --- | --- |
| `POST` | `/api/appointments` | `{ "serviceId", "barberId", "date", "time" }` | Cria um agendamento para o cliente autenticado. |
| `PATCH` | `/api/appointments/:id` | `{ "serviceId", "barberId", "date", "time" }` | Remarca um agendamento pertencente ao cliente autenticado. |
| `DELETE` | `/api/appointments/:id` | Sem corpo | Cancela um agendamento pertencente ao cliente autenticado. |

A disponibilidade exibida no navegador é apenas informativa. Ao criar ou remarcar, o backend deve validar novamente o horário dentro de uma transação para impedir dois agendamentos simultâneos para o mesmo barbeiro.

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

### Leituras a implementar

Quando o backend for conectado, os dados temporários deverão ser substituídos por:

- `GET /api/customers/me`
- `GET /api/services`
- `GET /api/barbers`
- `GET /api/appointments`
- `GET /api/appointments?scope=history`

## Regras mínimas para o backend MySQL

- Nunca armazenar senhas ou tokens de recuperação em texto puro.
- Normalizar e garantir a unicidade do e-mail.
- Validar todos os payloads também no servidor; a validação do navegador é apenas de experiência de uso.
- Exigir autenticação nas rotas de perfil, disponibilidade privada e agendamentos.
- Verificar se o agendamento pertence ao cliente antes de remarcar ou cancelar.
- Usar transação e bloqueio adequado ao confirmar horários, considerando a duração do serviço.
- Retornar `401` para sessão ausente/inválida, `403` para acesso indevido, `404` para recurso inexistente, `409` para conflito de horário e `422` para dados inválidos.
