
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'

export default function SignupPage() {
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Protótipo: sem autenticação real. Redireciona direto para o dashboard.
    router.push('/app')
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl text-foreground">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Cadastre-se para agendar seus horários.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Nome completo</FieldLabel>
            <Input id="name" placeholder="Seu nome" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Telefone</FieldLabel>
            <Input id="phone" type="tel" placeholder="(11) 90000-0000" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" type="email" placeholder="voce@email.com" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input id="password" type="password" placeholder="••••••••" required />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full">
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}
