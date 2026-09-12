'use client'

import { type FormEvent, useState } from 'react'
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import type { AdminUser } from '@/lib/types'

interface ApiResponse {
  user?: AdminUser
  invalidatesCurrentSession?: boolean
  message?: string
}

function sortUsers(users: AdminUser[]) {
  return [...users].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

export function AdminUsersManager({ initial }: { initial: AdminUser[] }) {
  const [users, setUsers] = useState(initial)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function startCreating() {
    setEditing(null)
    setFormKey((current) => current + 1)
  }

  function startEditing(user: AdminUser) {
    setEditing(user)
    setFormKey((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('passwordConfirmation') ?? '')
    if (password !== confirmation) {
      toast.error('A confirmação da senha não corresponde.')
      return
    }
    setIsSubmitting(true)

    try {
      const response = await fetch(
        editing ? `/api/admin/users/${encodeURIComponent(editing.id)}` : '/api/admin/users',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: data.get('name'),
            email: data.get('email'),
            password,
            isActive: editing ? editing.isCurrent || data.get('isActive') === 'on' : true,
          }),
        },
      )
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.user) {
        toast.error(result?.message ?? 'Não foi possível salvar o administrador.')
        return
      }

      if (result.invalidatesCurrentSession) {
        toast.success('Senha atualizada. Entre novamente para continuar.')
        window.location.assign('/admin/login')
        return
      }

      setUsers((current) =>
        sortUsers(
          editing
            ? current.map((user) => (user.id === result.user!.id ? result.user! : user))
            : [...current, result.user!],
        ),
      )
      toast.success(editing ? 'Administrador atualizado.' : 'Administrador criado.')
      setEditing(null)
      setFormKey((current) => current + 1)
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(320px,400px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form key={formKey} className="flex flex-col gap-5" onSubmit={saveUser}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-card-foreground">
                  {editing ? 'Editar administrador' : 'Novo administrador'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contas administrativas não aparecem no cadastro público.
                </p>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={startCreating}>
                  <Plus /> Novo
                </Button>
              )}
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nome
              <Input name="name" defaultValue={editing?.name ?? ''} minLength={3} maxLength={80} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              E-mail
              <Input name="email" type="email" defaultValue={editing?.email ?? ''} maxLength={254} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {editing ? 'Nova senha (opcional)' : 'Senha'}
              <PasswordInput
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required={!editing}
              />
              <span className="text-xs font-normal text-muted-foreground">
                Mínimo de 12 caracteres, com uma letra e um número.
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Confirmar senha
              <PasswordInput
                name="passwordConfirmation"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required={!editing}
              />
            </label>

            {editing && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editing.isActive}
                  disabled={editing.isCurrent}
                  className="size-4 accent-primary"
                />
                {editing.isCurrent ? 'Sua conta deve permanecer ativa' : 'Acesso administrativo ativo'}
              </label>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
              {isSubmitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar administrador'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Administradores</h2>
          <p className="text-sm text-muted-foreground">{users.length} conta(s) administrativa(s).</p>
        </div>
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <Card key={user.id} className={!user.isActive ? 'opacity-65' : undefined}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {user.isCurrent ? <KeyRound className="size-5" /> : <ShieldCheck className="size-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-card-foreground">{user.name}</span>
                      {user.isCurrent && <Badge variant="secondary">Você</Badge>}
                      <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => startEditing(user)}>
                  <Pencil /> Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
