// @vitest-environment jsdom

import { createElement, type ImgHTMLAttributes } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailVerification } from '@/components/auth/email-verification'

vi.mock('next/image', () => ({
  default: (
    props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean },
  ) => {
    const imageProps = { ...props }
    delete imageProps.fill
    delete imageProps.priority
    return createElement('img', imageProps)
  },
}))

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  window.history.replaceState({}, '', '/verificar-email?token=token-de-teste')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('confirmação de e-mail', () => {
  it('explica quando o link não contém token', () => {
    render(<EmailVerification />)

    expect(screen.getByRole('heading', { name: 'Link inválido' })).toBeTruthy()
    expect(screen.getByText('Este link não contém um token de confirmação.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar meu e-mail' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ir para o login' }).getAttribute('href')).toBe(
      '/login',
    )
  })

  it('aguarda uma ação explícita antes de confirmar', () => {
    render(<EmailVerification token="token-secreto" />)

    expect(screen.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar meu e-mail' })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('remove o token da URL e confirma com a API após o clique', async () => {
    let finishRequest: (response: Response) => void = () => undefined
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishRequest = resolve
      }),
    )
    render(<EmailVerification token="token-secreto" />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }))

    expect(await screen.findByRole('heading', { name: 'Confirmando e-mail' })).toBeTruthy()
    expect(screen.getByText('Estamos validando seu link de confirmação.')).toBeTruthy()
    expect(window.location.pathname).toBe('/verificar-email')
    expect(window.location.search).toBe('')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'token-secreto' }),
    })

    finishRequest(
      new Response(JSON.stringify({ message: 'Conta ativada.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(await screen.findByRole('heading', { name: 'E-mail confirmado' })).toBeTruthy()
    expect(screen.getByText('Conta ativada.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ir para o login' }).getAttribute('href')).toBe(
      '/login',
    )
  })

  it('mostra o erro devolvido pela API sem oferecer repetição automática', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Token expirado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    render(<EmailVerification token="token-expirado" />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }))

    expect(await screen.findByRole('heading', { name: 'Link inválido' })).toBeTruthy()
    expect(screen.getByText('Token expirado.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ir para o login' })).toBeTruthy()
  })

  it('permite tentar novamente depois de uma falha de rede', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('rede indisponível'))
      .mockResolvedValueOnce(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
    render(<EmailVerification token="token-secreto" />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar meu e-mail' }))

    const retryButton = await screen.findByRole('button', { name: 'Tentar novamente' })
    expect(screen.getByText('Não foi possível conectar ao servidor. Tente novamente.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ir para o login' })).toBeNull()

    fireEvent.click(retryButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: 'E-mail confirmado' })).toBeTruthy()
    expect(screen.getByText('E-mail confirmado com sucesso.')).toBeTruthy()
  })
})
