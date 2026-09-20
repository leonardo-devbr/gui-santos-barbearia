import type { Metadata } from 'next'
import { EmailVerification } from '@/components/auth/email-verification'

export const metadata: Metadata = {
  title: 'Confirmar e-mail | Gui Santos Barbearia',
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return <EmailVerification token={token?.trim()} />
}
