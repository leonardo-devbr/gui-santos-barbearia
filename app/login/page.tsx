'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export default function LoginPage() {
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Protótipo: sem autenticação real. Redireciona direto para o dashboard.
    router.push('/app')
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl text-foreground">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Entre para agendar seu próximo horário.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" type="email" placeholder="voce@email.com" required defaultValue="cliente@email.com" />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Link href="#" className="text-xs text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" required defaultValue="123456" />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full">
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  )
}
