'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import {
  type AdminUserFormErrors,
  type AdminUserFormField,
  validateAdminUserForm,
} from '@/lib/admin-form-validation'
import type { AdminBarber, StaffAccount, StaffRole } from '@/lib/types'
import { formatPhone } from '@/lib/validation'

interface ApiResponse {
  user?: StaffAccount
  invalidatesCurrentSession?: boolean
  message?: string
  errors?: AdminUserFormErrors
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
  const [notificationPhone, setNotificationPhone] = useState('')
  const [errors, setErrors] = useState<AdminUserFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: AdminUserFormField) {
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  function startCreating() {
    setEditing(null)
    setRole('barber')
    setNotificationPhone('')
    setErrors({})
    setSubmitError(null)
    setFormKey((current) => current + 1)
  }

  function startEditing(user: StaffAccount) {
    setEditing(user)
    setRole(user.role)
    setNotificationPhone(formatPhone(user.notificationPhone))
    setErrors({})
    setSubmitError(null)
    setFormKey((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const validation = validateAdminUserForm(
      {
        role,
        barberId: String(data.get('barberId') ?? ''),
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
        passwordConfirmation: String(data.get('passwordConfirmation') ?? ''),
        currentPassword: String(data.get('currentPassword') ?? ''),
        notificationPhone: String(data.get('notificationPhone') ?? ''),
        whatsappOptIn: data.get('whatsappOptIn') === 'on',
      },
      Boolean(editing),
    )

    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        editing ? `/api/admin/users/${encodeURIComponent(editing.id)}` : '/api/admin/users',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...validation.data,
            isActive: editing ? editing.isCurrent || data.get('isActive') === 'on' : true,
          }),
        },
      )
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.user) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível salvar o acesso. Tente novamente.')
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
      setNotificationPhone('')
      setErrors({})
      setSubmitError(null)
      setFormKey((current) => current + 1)
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
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
          <form
            key={formKey}
            className="flex flex-col gap-5"
            onSubmit={saveUser}
            noValidate
            aria-busy={isSubmitting}
          >
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

            <FieldGroup>
              <Field data-invalid={Boolean(errors.role)}>
                <FieldLabel htmlFor="staff-role">Tipo de acesso</FieldLabel>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(event) => {
                    const nextRole = event.target.value as StaffRole
                    setRole(nextRole)
                    clearError('role')
                    if (nextRole === 'admin') clearError('barberId')
                  }}
                  disabled={editing?.isCurrent}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:opacity-60"
                  aria-invalid={Boolean(errors.role)}
                  aria-describedby={errors.role ? 'staff-role-error' : undefined}
                >
                  <option value="barber">Barbeiro — somente a própria agenda</option>
                  <option value="admin">Administrador — acesso completo</option>
                </select>
                <FieldError id="staff-role-error">{errors.role}</FieldError>
              </Field>

              {role === 'barber' && (
                <Field data-invalid={Boolean(errors.barberId)}>
                  <FieldLabel htmlFor="staff-barber">Perfil do barbeiro</FieldLabel>
                  <select
                    id="staff-barber"
                    name="barberId"
                    defaultValue={editing?.barberId ?? ''}
                    required
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                    aria-invalid={Boolean(errors.barberId)}
                    aria-describedby={errors.barberId ? 'staff-barber-error' : undefined}
                    onChange={() => clearError('barberId')}
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
                  <FieldError id="staff-barber-error">{errors.barberId}</FieldError>
                </Field>
              )}

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="staff-name">Nome de exibição</FieldLabel>
                <Input
                  id="staff-name"
                  name="name"
                  autoComplete="name"
                  defaultValue={editing?.name ?? ''}
                  minLength={3}
                  maxLength={80}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'staff-name-error' : undefined}
                  onValueChange={() => clearError('name')}
                  required
                />
                <FieldError id="staff-name-error">{errors.name}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="staff-email">E-mail de acesso</FieldLabel>
                <Input
                  id="staff-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  defaultValue={editing?.email ?? ''}
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'staff-email-error' : undefined}
                  onValueChange={() => clearError('email')}
                  required
                />
                <FieldError id="staff-email-error">{errors.email}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.notificationPhone)}>
                <FieldLabel htmlFor="staff-notification-phone">Telefone para avisos</FieldLabel>
                <Input
                  id="staff-notification-phone"
                  name="notificationPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={notificationPhone}
                  maxLength={15}
                  placeholder="(15) 99999-9999"
                  aria-invalid={Boolean(errors.notificationPhone)}
                  aria-describedby={
                    errors.notificationPhone
                      ? 'staff-notification-phone-error'
                      : 'staff-notification-phone-help'
                  }
                  onValueChange={(value) => {
                    setNotificationPhone(formatPhone(value))
                    clearError('notificationPhone')
                  }}
                />
                {!errors.notificationPhone && (
                  <p
                    id="staff-notification-phone-help"
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Usado somente nos avisos internos de agendamento.
                  </p>
                )}
                <FieldError id="staff-notification-phone-error">
                  {errors.notificationPhone}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.whatsappOptIn)}>
                <label
                  htmlFor="staff-whatsapp-opt-in"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed"
                >
                  <input
                    id="staff-whatsapp-opt-in"
                    name="whatsappOptIn"
                    type="checkbox"
                    defaultChecked={editing?.whatsappOptIn ?? false}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    aria-invalid={Boolean(errors.whatsappOptIn)}
                    aria-describedby={
                      errors.whatsappOptIn
                        ? 'staff-whatsapp-opt-in-error staff-whatsapp-opt-in-help'
                        : 'staff-whatsapp-opt-in-help'
                    }
                    onChange={() => clearError('whatsappOptIn')}
                  />
                  <span>
                    Confirmo que esta pessoa autorizou a Gui Santos Barbearia a enviar avisos de
                    agendamentos pelo WhatsApp.
                  </span>
                </label>
                <p
                  id="staff-whatsapp-opt-in-help"
                  className="text-xs font-normal text-muted-foreground"
                >
                  O consentimento é opcional e pode ser retirado a qualquer momento.
                </p>
                <FieldError id="staff-whatsapp-opt-in-error">{errors.whatsappOptIn}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="staff-password">
                  {editing ? 'Nova senha (opcional)' : 'Senha inicial'}
                </FieldLabel>
                <PasswordInput
                  id="staff-password"
                  name="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Mínimo de 12 caracteres"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'staff-password-error' : 'staff-password-help'}
                  onValueChange={() => clearError('password')}
                  required={!editing}
                />
                {!errors.password && (
                  <p id="staff-password-help" className="text-xs font-normal text-muted-foreground">
                    Use ao menos 12 caracteres, incluindo uma letra e um número.
                  </p>
                )}
                <FieldError id="staff-password-error">{errors.password}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.passwordConfirmation)}>
                <FieldLabel htmlFor="staff-password-confirmation">Confirmar senha</FieldLabel>
                <PasswordInput
                  id="staff-password-confirmation"
                  name="passwordConfirmation"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  aria-invalid={Boolean(errors.passwordConfirmation)}
                  aria-describedby={
                    errors.passwordConfirmation ? 'staff-password-confirmation-error' : undefined
                  }
                  onValueChange={() => clearError('passwordConfirmation')}
                  required={!editing}
                />
                <FieldError id="staff-password-confirmation-error">
                  {errors.passwordConfirmation}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.currentPassword)}>
                <FieldLabel htmlFor="staff-current-password">
                  Sua senha atual de administrador
                </FieldLabel>
                <PasswordInput
                  id="staff-current-password"
                  name="currentPassword"
                  maxLength={128}
                  autoComplete="current-password"
                  placeholder="Confirme sua senha atual"
                  aria-invalid={Boolean(errors.currentPassword)}
                  aria-describedby={
                    errors.currentPassword ? 'staff-current-password-error' : 'staff-current-password-help'
                  }
                  onValueChange={() => clearError('currentPassword')}
                  required
                />
                {!errors.currentPassword && (
                  <p id="staff-current-password-help" className="text-xs font-normal text-muted-foreground">
                    Confirma sua identidade antes de alterar os acessos da equipe.
                  </p>
                )}
                <FieldError id="staff-current-password-error">{errors.currentPassword}</FieldError>
              </Field>
            </FieldGroup>

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

            {submitError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {submitError}
              </p>
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
                    <p className="text-xs text-muted-foreground">
                      WhatsApp:{' '}
                      {user.whatsappOptIn
                        ? `${formatPhone(user.notificationPhone)} — autorizado`
                        : 'não autorizado'}
                    </p>
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
