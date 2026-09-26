'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import type { AdminBarber, StaffAccount, StaffRole } from '@/lib/types'

interface ApiResponse {
  user?: StaffAccount
  invalidatesCurrentSession?: boolean
  message?: string
}

function sortUsers(users: StaffAccount[]) {
  return [...users].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
    if (left.role !== right.role) return left.role === 'admin' ? -1 : 1
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

export function AdminUsersManager({
  initial,
  barbers,
}: {
  initial: StaffAccount[]
  barbers: AdminBarber[]
}) {
  const router = useRouter()
  const [users, setUsers] = useState(initial)
  const [editing, setEditing] = useState<StaffAccount | null>(null)
  const [role, setRole] = useState<StaffRole>('barber')
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function startCreating() {
    setEditing(null)
    setRole('barber')
    setFormKey((current) => current + 1)
  }

  function startEditing(user: StaffAccount) {
    setEditing(user)
    setRole(user.role)
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
            role,
            barberId: role === 'barber' ? data.get('barberId') : null,
            currentPassword: data.get('currentPassword'),
            isActive: editing ? editing.isCurrent || data.get('isActive') === 'on' : true,
          }),
        },
      )
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.user) {
        toast.error(result?.message ?? 'Não foi possível salvar o acesso.')
        return
      }

      if (result.invalidatesCurrentSession) {
        toast.success('Senha atualizada. Entre novamente para continuar.')
        router.replace('/admin/login')
        router.refresh()
        return
      }

      setUsers((current) =>
        sortUsers(
          editing
            ? current.map((user) => (user.id === result.user!.id ? result.user! : user))
            : [...current, result.user!],
        ),
      )
      toast.success(editing ? 'Acesso atualizado.' : 'Acesso criado.')
      setEditing(null)
      setRole('barber')
      setFormKey((current) => current + 1)
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const assignedBarberIds = new Set(
    users
      .filter((user) => user.role === 'barber' && user.id !== editing?.id)
      .map((user) => user.barberId),
  )
  const adminCount = users.filter((user) => user.role === 'admin').length
  const barberCount = users.filter((user) => user.role === 'barber').length

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(320px,400px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form key={formKey} className="flex flex-col gap-5" onSubmit={saveUser}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-card-foreground">
                  {editing ? 'Editar acesso' : 'Novo acesso'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Barbeiros acessam somente a agenda vinculada ao perfil profissional.
                </p>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={startCreating}>
                  <Plus /> Novo
                </Button>
              )}
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tipo de acesso
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as StaffRole)}
                disabled={editing?.isCurrent}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-60"
              >
                <option value="barber">Barbeiro — somente a própria agenda</option>
                <option value="admin">Administrador — acesso completo</option>
              </select>
            </label>

            {role === 'barber' && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Perfil do barbeiro
                <select
                  name="barberId"
                  defaultValue={editing?.barberId ?? ''}
                  required
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="" disabled>
                    Selecione o profissional
                  </option>
                  {barbers.map((barber) => {
                    const unavailable =
                      assignedBarberIds.has(barber.id) ||
                      (!barber.isActive && barber.id !== editing?.barberId)
                    return (
                      <option key={barber.id} value={barber.id} disabled={unavailable}>
                        {barber.name}
                        {!barber.isActive ? ' — inativo' : unavailable ? ' — já possui acesso' : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nome de exibição
              <Input name="name" defaultValue={editing?.name ?? ''} minLength={3} maxLength={80} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              E-mail de acesso
              <Input name="email" type="email" defaultValue={editing?.email ?? ''} maxLength={254} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {editing ? 'Nova senha (opcional)' : 'Senha inicial'}
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
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Sua senha atual de administrador
              <PasswordInput
                name="currentPassword"
                maxLength={128}
                autoComplete="current-password"
                required
              />
              <span className="text-xs font-normal text-muted-foreground">
                Confirma sua identidade antes de alterar os acessos da equipe.
              </span>
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
                {editing.isCurrent ? 'Sua conta deve permanecer ativa' : 'Acesso ativo'}
              </label>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" />
              ) : role === 'admin' ? (
                <ShieldCheck />
              ) : (
                <UserRound />
              )}
              {isSubmitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar acesso'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Contas da equipe</h2>
          <p className="text-sm text-muted-foreground">
            {adminCount} administrador(es) e {barberCount} barbeiro(s) com acesso.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <Card key={user.id} className={!user.isActive ? 'opacity-65' : undefined}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {user.isCurrent ? (
                      <KeyRound className="size-5" />
                    ) : user.role === 'admin' ? (
                      <ShieldCheck className="size-5" />
                    ) : (
                      <UserRound className="size-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-card-foreground">{user.name}</span>
                      {user.isCurrent && <Badge variant="secondary">Você</Badge>}
                      <Badge variant="outline">
                        {user.role === 'admin' ? 'Administrador' : 'Barbeiro'}
                      </Badge>
                      <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                        {user.isActive ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.barberName && (
                      <p className="text-xs text-muted-foreground">Agenda: {user.barberName}</p>
                    )}
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
