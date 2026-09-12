import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { AuthShell } from '@/components/auth-shell'

export const metadata: Metadata = {
  title: 'Acesso administrativo | Gui Santos Barbearia',
}

export default function AdminLoginPage() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-[0.2em] text-primary">ÁREA RESTRITA</span>
          <h1 className="font-serif text-3xl text-foreground">Painel administrativo</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Entre com uma conta autorizada da equipe para gerenciar a agenda.
          </p>
        </div>
      </div>

      <AdminLoginForm />

      <Link href="/" className="text-center text-sm text-muted-foreground hover:text-primary">
        Voltar para o site
      </Link>
    </AuthShell>
  )
}
