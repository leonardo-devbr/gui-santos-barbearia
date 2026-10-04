'use client'

import { type FormEvent, useState } from 'react'
import { Building2, Clock, LoaderCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getWeekdayLabel } from '@/lib/business-labels'
import type { BusinessConfiguration, BusinessHour, BusinessSettings } from '@/lib/types'

interface SettingsResponse {
  settings?: BusinessSettings
  message?: string
}

interface HoursResponse {
  hours?: BusinessHour[]
  message?: string
}

export function AdminBusinessManager({ initial }: { initial: BusinessConfiguration }) {
  const [settings, setSettings] = useState(initial.settings)
  const [hours, setHours] = useState(initial.hours)
  const [savingSection, setSavingSection] = useState<'settings' | 'hours' | null>(null)

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSavingSection('settings')

    try {
      const response = await fetch('/api/admin/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(Object.fromEntries(data)),
      })
      const result = (await response.json().catch(() => null)) as SettingsResponse | null

      if (!response.ok || !result?.settings) {
        toast.error(result?.message ?? 'Não foi possível salvar os dados.')
        return
      }

      setSettings(result.settings)
      toast.success('Dados da barbearia atualizados.')
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setSavingSection(null)
    }
  }

  function updateHour(weekday: number, patch: Partial<BusinessHour>) {
    setHours((current) =>
      current.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)),
    )
  }

  async function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingSection('hours')

    try {
      const response = await fetch('/api/admin/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hours }),
      })
      const result = (await response.json().catch(() => null)) as HoursResponse | null

      if (!response.ok || !result?.hours) {
        toast.error(result?.message ?? 'Não foi possível salvar os horários.')
        return
      }

      setHours(result.hours)
      toast.success('Horários de funcionamento atualizados.')
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setSavingSection(null)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
      <Card>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={saveSettings}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-card-foreground">Dados da barbearia</h2>
                <p className="text-sm text-muted-foreground">Contato, endereço e localização pública.</p>
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nome
              <Input name="name" defaultValue={settings.name} minLength={2} maxLength={100} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Endereço
              <Input name="street" defaultValue={settings.street} minLength={3} maxLength={160} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Bairro
                <Input name="district" defaultValue={settings.district} minLength={2} maxLength={100} required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Cidade
                <Input name="city" defaultValue={settings.city} minLength={2} maxLength={100} required />
              </label>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Estado
                <Input name="state" defaultValue={settings.state} minLength={2} maxLength={2} required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                CEP
                <Input name="postalCode" defaultValue={settings.postalCode} inputMode="numeric" required />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Telefone
                <Input name="phone" defaultValue={settings.phone} inputMode="tel" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                E-mail
                <Input name="email" type="email" defaultValue={settings.email} maxLength={254} required />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              CNPJ
              <Input name="cnpj" defaultValue={settings.cnpj} inputMode="numeric" placeholder="Opcional" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Latitude
                <Input name="latitude" type="number" min={-90} max={90} step="0.0000001" defaultValue={settings.latitude} required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Longitude
                <Input name="longitude" type="number" min={-180} max={180} step="0.0000001" defaultValue={settings.longitude} required />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Informação de estacionamento
              <Textarea name="parkingInfo" defaultValue={settings.parkingInfo} maxLength={255} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Informação de transporte
              <Textarea name="transitInfo" defaultValue={settings.transitInfo} maxLength={255} />
            </label>
            <Button type="submit" size="lg" disabled={savingSection !== null}>
              {savingSection === 'settings' ? <LoaderCircle className="animate-spin" /> : <Save />}
              {savingSection === 'settings' ? 'Salvando...' : 'Salvar dados'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={saveHours}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="size-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-card-foreground">Horários de funcionamento</h2>
                <p className="text-sm text-muted-foreground">Define os horários oferecidos aos clientes.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {hours.map((hour) => (
                <div key={hour.weekday} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[140px_1fr] sm:items-center">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={hour.isOpen}
                      onChange={(event) =>
                        updateHour(hour.weekday, {
                          isOpen: event.target.checked,
                          openTime: event.target.checked ? hour.openTime ?? '09:00' : null,
                          closeTime: event.target.checked ? hour.closeTime ?? '18:00' : null,
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    {getWeekdayLabel(hour.weekday)}
                  </label>

                  {hour.isOpen ? (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Input
                        type="time"
                        value={hour.openTime ?? '09:00'}
                        onChange={(event) => updateHour(hour.weekday, { openTime: event.target.value })}
                        step={1800}
                        aria-label={`Abertura de ${getWeekdayLabel(hour.weekday)}`}
                        required
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={hour.closeTime ?? '18:00'}
                        onChange={(event) => updateHour(hour.weekday, { closeTime: event.target.value })}
                        step={1800}
                        aria-label={`Fechamento de ${getWeekdayLabel(hour.weekday)}`}
                        required
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
            </div>
            <Button type="submit" size="lg" disabled={savingSection !== null}>
              {savingSection === 'hours' ? <LoaderCircle className="animate-spin" /> : <Save />}
              {savingSection === 'hours' ? 'Salvando...' : 'Salvar horários'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
