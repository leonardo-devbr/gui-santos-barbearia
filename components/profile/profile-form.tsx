'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldGroup } from '@/components/ui/field'
import type { CustomerProfile } from '@/lib/types'

export function ProfileForm({ customer }: { customer: CustomerProfile }) {
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    birthDate: customer.birthDate,
    preferredCut: customer.preferredCut,
    beardStyle: customer.beardStyle,
    notes: customer.notes,
  })

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    toast.success('Perfil atualizado', {
      description: 'Suas informações foram salvas com sucesso.',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-serif text-lg text-card-foreground">Dados pessoais</h2>
          <FieldGroup>
            <Field>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <Field orientation="responsive">
              <Field>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </Field>
              <Field>
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => update('birthDate', e.target.value)}
                />
              </Field>
            </Field>
            <Field>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-serif text-lg text-card-foreground">Preferências de atendimento</h2>
          <FieldGroup>
            <Field orientation="responsive">
              <Field>
                <Label htmlFor="preferredCut">Corte preferido</Label>
                <Input
                  id="preferredCut"
                  value={form.preferredCut}
                  onChange={(e) => update('preferredCut', e.target.value)}
                />
              </Field>
              <Field>
                <Label htmlFor="beardStyle">Estilo de barba</Label>
                <Input
                  id="beardStyle"
                  value={form.beardStyle}
                  onChange={(e) => update('beardStyle', e.target.value)}
                />
              </Field>
            </Field>
            <Field>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Preferências, alergias ou observações para o barbeiro."
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">Salvar alterações</Button>
      </div>
    </form>
  )
}
