import { describe, expect, it, vi } from 'vitest'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'

const JSON_LIMIT = 16 * 1024

function jsonBodyWithByteLength(length: number) {
  const prefix = '{"value":"'
  const suffix = '"}'
  return `${prefix}${'a'.repeat(length - prefix.length - suffix.length)}${suffix}`
}

function jsonRequest(body: string, headers: HeadersInit = {}) {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('leitura segura da API', () => {
  it('aceita somente objetos JSON', async () => {
    await expect(
      readJsonObject(
        jsonRequest('{"name":"Ana"}', { 'Content-Type': ' Application/JSON ; charset=utf-8 ' }),
      ),
    ).resolves.toEqual({ name: 'Ana' })

    for (const body of ['null', '[]', '"texto"', '12', '{inválido']) {
      await expect(readJsonObject(jsonRequest(body))).resolves.toBeNull()
    }
  })

  it('recusa tipo de conteúdo incorreto e requisição sem corpo', async () => {
    const textRequest = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    })
    const emptyRequest = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(readJsonObject(textRequest)).resolves.toBeNull()
    await expect(readJsonObject(emptyRequest)).resolves.toBeNull()
  })

  it('recusa content-length declarado acima de 16 KiB', async () => {
    await expect(
      readJsonObject(jsonRequest('{}', { 'Content-Length': String(JSON_LIMIT + 1) })),
    ).resolves.toBeNull()
  })

  it('mede o corpo real em bytes quando content-length não existe', async () => {
    await expect(readJsonObject(jsonRequest(jsonBodyWithByteLength(JSON_LIMIT)))).resolves.toEqual({
      value: 'a'.repeat(JSON_LIMIT - 12),
    })
    await expect(
      readJsonObject(jsonRequest(jsonBodyWithByteLength(JSON_LIMIT + 1))),
    ).resolves.toBeNull()
  })

  it('gera respostas de erro estruturadas', async () => {
    const response = errorResponse('Inválido', 422, { email: 'E-mail inválido.' })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      message: 'Inválido',
      errors: { email: 'E-mail inválido.' },
    })
  })

  it('não expõe detalhes de erros internos na resposta', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const privateError = new Error('senha-secreta')
    const response = internalErrorResponse(privateError)

    expect(consoleError).toHaveBeenCalledWith(privateError)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      message: 'Não foi possível concluir a solicitação. Tente novamente mais tarde.',
    })
  })
})
