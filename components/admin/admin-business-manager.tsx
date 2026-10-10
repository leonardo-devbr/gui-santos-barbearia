'use client'

import { type FormEvent, useState } from 'react'
import { Building2, Clock, LoaderCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TimeSelect } from '@/components/ui/time-select'
import { getWeekdayLabel } from '@/lib/business-labels'
import {
  getApiMessage,
  type AdminBusinessFormErrors,
  type AdminBusinessFormField,
  validateAdminBusinessForm,
  validateAdminBusinessHours,
} from '@/lib/admin-settings-form-validation'
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
  const [settingsErrors, setSettingsErrors] = useState<AdminBusinessFormErrors>({})
  const [settingsSubmitError, setSettingsSubmitError] = useState<string | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [invalidHourWeekday, setInvalidHourWeekday] = useState<number | null>(null)
  const [savingSection, setSavingSection] = useState<'settings' | 'hours' | null>(null)

  function clearSettingsError(field: AdminBusinessFormField) {
    setSettingsErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSettingsSubmitError(null)
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const validation = validateAdminBusinessForm({
      name: String(data.get('name') ?? ''),
      street: String(data.get('street') ?? ''),
      district: String(data.get('district') ?? ''),
      city: String(data.get('city') ?? ''),
      state: String(data.get('state') ?? ''),
      postalCode: String(data.get('postalCode') ?? ''),
      phone: String(data.get('phone') ?? ''),
      email: String(data.get('email') ?? ''),
      cnpj: String(data.get('cnpj') ?? ''),
      latitude: String(data.get('latitude') ?? ''),
      longitude: String(data.get('longitude') ?? ''),
      parkingInfo: String(data.get('parkingInfo') ?? ''),
      transitInfo: String(data.get('transitInfo') ?? ''),
    })

    if (Object.keys(validation.errors).length > 0) {
      setSettingsErrors(validation.errors)
      setSettingsSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setSettingsErrors({})
    setSettingsSubmitError(null)
    setSavingSection('settings')

    try {
      const response = await fetch('/api/admin/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validation.data),
      })
      const result = (await response.json().catch(() => null)) as SettingsResponse | null

      if (!response.ok || !result?.settings) {
        setSettingsSubmitError(
          getApiMessage(result, 'Não foi possível salvar os dados. Tente novamente.'),
        )
        return
      }

      setSettings(result.settings)
      setSettingsErrors({})
      setSettingsSubmitError(null)
      toast.success('Dados da barbearia atualizados.')
    } catch {
      setSettingsSubmitError(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      )
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

    const invalidHour = validateAdminBusinessHours(hours)
    if (invalidHour) {
      setHoursError(
        `Em ${getWeekdayLabel(invalidHour.weekday)}, ${invalidHour.message.toLocaleLowerCase('pt-BR')}`,
      )
      setInvalidHourWeekday(invalidHour.weekday)
      return
    }

    setHoursError(null)
    setInvalidHourWeekday(null)
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
        setHoursError(
          getApiMessage(result, 'Não foi possível salvar os horários. Tente novamente.'),
        )
        return
      }

      setHours(result.hours)
      toast.success('Horários de funcionamento atualizados.')
    } catch {
      setHoursError('Não foi possível conectar ao servidor. Tente novamente em instantes.')
    } finally {
      setSavingSection(null)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={saveSettings}
            noValidate
            aria-busy={savingSection === 'settings'}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-card-foreground">Dados da barbearia</h2>
                <p className="text-sm text-muted-foreground">Contato, endereço e localização pública.</p>
              </div>
            </div>

            <FieldGroup>
              <Field data-invalid={Boolean(settingsErrors.name)}>
                <FieldLabel htmlFor="business-name">Nome</FieldLabel>
                <Input
                  id="business-name"
                  name="name"
                  defaultValue={settings.name}
                  minLength={2}
                  maxLength={100}
                  aria-invalid={Boolean(settingsErrors.name)}
                  aria-describedby={settingsErrors.name ? 'business-name-error' : undefined}
                  onValueChange={() => clearSettingsError('name')}
                  required
                />
                <FieldError id="business-name-error">{settingsErrors.name}</FieldError>
              </Field>

              <Field data-invalid={Boolean(settingsErrors.street)}>
                <FieldLabel htmlFor="business-street">Endereço</FieldLabel>
                <Input
                  id="business-street"
                  name="street"
                  defaultValue={settings.street}
                  minLength={3}
                  maxLength={160}
                  aria-invalid={Boolean(settingsErrors.street)}
                  aria-describedby={settingsErrors.street ? 'business-street-error' : undefined}
                  onValueChange={() => clearSettingsError('street')}
                  required
                />
                <FieldError id="business-street-error">{settingsErrors.street}</FieldError>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(settingsErrors.district)}>
                  <FieldLabel htmlFor="business-district">Bairro</FieldLabel>
                  <Input
                    id="business-district"
                    name="district"
                    defaultValue={settings.district}
                    minLength={2}
                    maxLength={100}
                    aria-invalid={Boolean(settingsErrors.district)}
                    aria-describedby={settingsErrors.district ? 'business-district-error' : undefined}
                    onValueChange={() => clearSettingsError('district')}
                    required
                  />
                  <FieldError id="business-district-error">{settingsErrors.district}</FieldError>
                </Field>
                <Field data-invalid={Boolean(settingsErrors.city)}>
                  <FieldLabel htmlFor="business-city">Cidade</FieldLabel>
                  <Input
                    id="business-city"
                    name="city"
                    defaultValue={settings.city}
                    minLength={2}
                    maxLength={100}
                    aria-invalid={Boolean(settingsErrors.city)}
                    aria-describedby={settingsErrors.city ? 'business-city-error' : undefined}
                    onValueChange={() => clearSettingsError('city')}
                    required
                  />
                  <FieldError id="business-city-error">{settingsErrors.city}</FieldError>
                </Field>
              </div>

              <div className="grid grid-cols-[90px_1fr] gap-3">
                <Field data-invalid={Boolean(settingsErrors.state)}>
                  <FieldLabel htmlFor="business-state">Estado</FieldLabel>
                  <Input
                    id="business-state"
                    name="state"
                    defaultValue={settings.state}
                    minLength={2}
                    maxLength={2}
                    autoCapitalize="characters"
                    aria-invalid={Boolean(settingsErrors.state)}
                    aria-describedby={settingsErrors.state ? 'business-state-error' : undefined}
                    onValueChange={() => clearSettingsError('state')}
                    required
                  />
                  <FieldError id="business-state-error">{settingsErrors.state}</FieldError>
                </Field>
                <Field data-invalid={Boolean(settingsErrors.postalCode)}>
                  <FieldLabel htmlFor="business-postal-code">CEP</FieldLabel>
                  <Input
                    id="business-postal-code"
                    name="postalCode"
                    defaultValue={settings.postalCode}
                    inputMode="numeric"
                    maxLength={9}
                    aria-invalid={Boolean(settingsErrors.postalCode)}
                    aria-describedby={settingsErrors.postalCode ? 'business-postal-code-error' : undefined}
                    onValueChange={() => clearSettingsError('postalCode')}
                    required
                  />
                  <FieldError id="business-postal-code-error">{settingsErrors.postalCode}</FieldError>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(settingsErrors.phone)}>
                  <FieldLabel htmlFor="business-phone">Telefone</FieldLabel>
                  <Input
                    id="business-phone"
                    name="phone"
                    defaultValue={settings.phone}
                    inputMode="tel"
                    maxLength={16}
                    aria-invalid={Boolean(settingsErrors.phone)}
                    aria-describedby={settingsErrors.phone ? 'business-phone-error' : undefined}
                    onValueChange={() => clearSettingsError('phone')}
                    required
                  />
                  <FieldError id="business-phone-error">{settingsErrors.phone}</FieldError>
                </Field>
                <Field data-invalid={Boolean(settingsErrors.email)}>
                  <FieldLabel htmlFor="business-email">E-mail</FieldLabel>
                  <Input
                    id="business-email"
                    name="email"
                    type="email"
                    defaultValue={settings.email}
                    maxLength={254}
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={Boolean(settingsErrors.email)}
                    aria-describedby={settingsErrors.email ? 'business-email-error' : undefined}
                    onValueChange={() => clearSettingsError('email')}
                    required
                  />
                  <FieldError id="business-email-error">{settingsErrors.email}</FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(settingsErrors.cnpj)}>
                <FieldLabel htmlFor="business-cnpj">CNPJ</FieldLabel>
                <Input
                  id="business-cnpj"
                  name="cnpj"
                  defaultValue={settings.cnpj}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="Opcional"
                  aria-invalid={Boolean(settingsErrors.cnpj)}
                  aria-describedby={settingsErrors.cnpj ? 'business-cnpj-error' : undefined}
                  onValueChange={() => clearSettingsError('cnpj')}
                />
                <FieldError id="business-cnpj-error">{settingsErrors.cnpj}</FieldError>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(settingsErrors.latitude)}>
                  <FieldLabel htmlFor="business-latitude">Latitude</FieldLabel>
                  <Input
                    id="business-latitude"
                    name="latitude"
                    type="number"
                    min={-90}
                    max={90}
                    step="0.0000001"
                    defaultValue={settings.latitude}
                    aria-invalid={Boolean(settingsErrors.latitude)}
                    aria-describedby={settingsErrors.latitude ? 'business-latitude-error' : undefined}
                    onValueChange={() => clearSettingsError('latitude')}
                    required
                  />
                  <FieldError id="business-latitude-error">{settingsErrors.latitude}</FieldError>
                </Field>
                <Field data-invalid={Boolean(settingsErrors.longitude)}>
                  <FieldLabel htmlFor="business-longitude">Longitude</FieldLabel>
                  <Input
                    id="business-longitude"
                    name="longitude"
                    type="number"
                    min={-180}
                    max={180}
                    step="0.0000001"
                    defaultValue={settings.longitude}
                    aria-invalid={Boolean(settingsErrors.longitude)}
                    aria-describedby={settingsErrors.longitude ? 'business-longitude-error' : undefined}
                    onValueChange={() => clearSettingsError('longitude')}
                    required
                  />
                  <FieldError id="business-longitude-error">{settingsErrors.longitude}</FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(settingsErrors.parkingInfo)}>
                <FieldLabel htmlFor="business-parking-info">Informação de estacionamento</FieldLabel>
                <Textarea
                  id="business-parking-info"
                  name="parkingInfo"
                  defaultValue={settings.parkingInfo}
                  maxLength={255}
                  aria-invalid={Boolean(settingsErrors.parkingInfo)}
                  aria-describedby={settingsErrors.parkingInfo ? 'business-parking-info-error' : undefined}
                  onChange={() => clearSettingsError('parkingInfo')}
                />
                <FieldError id="business-parking-info-error">{settingsErrors.parkingInfo}</FieldError>
              </Field>

              <Field data-invalid={Boolean(settingsErrors.transitInfo)}>
                <FieldLabel htmlFor="business-transit-info">Informação de transporte</FieldLabel>
                <Textarea
                  id="business-transit-info"
                  name="transitInfo"
                  defaultValue={settings.transitInfo}
                  maxLength={255}
                  aria-invalid={Boolean(settingsErrors.transitInfo)}
                  aria-describedby={settingsErrors.transitInfo ? 'business-transit-info-error' : undefined}
                  onChange={() => clearSettingsError('transitInfo')}
                />
                <FieldError id="business-transit-info-error">{settingsErrors.transitInfo}</FieldError>
              </Field>
            </FieldGroup>

            {settingsSubmitError && (
              <FieldError className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                {settingsSubmitError}
              </FieldError>
            )}
            <Button type="submit" size="lg" disabled={savingSection !== null}>
              {savingSection === 'settings' ? <LoaderCircle className="animate-spin" /> : <Save />}
              {savingSection === 'settings' ? 'Salvando...' : 'Salvar dados'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={saveHours}
            noValidate
            aria-busy={savingSection === 'hours'}
          >
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
              {hours.map((hour) => {
                const isInvalid = invalidHourWeekday === hour.weekday

                return (
                <div
                  key={hour.weekday}
                  data-invalid={isInvalid}
                  className="grid gap-3 rounded-xl border border-border p-3 data-[invalid=true]:border-destructive/70 data-[invalid=true]:bg-destructive/5 sm:grid-cols-[140px_1fr] sm:items-center"
                >
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={hour.isOpen}
                      onChange={(event) => {
                        updateHour(hour.weekday, {
                          isOpen: event.target.checked,
                          openTime: event.target.checked ? hour.openTime ?? '09:00' : null,
                          closeTime: event.target.checked ? hour.closeTime ?? '18:00' : null,
                        })
                        setHoursError(null)
                        setInvalidHourWeekday(null)
                      }}
                      className="size-4 accent-primary"
                    />
                    {getWeekdayLabel(hour.weekday)}
                  </label>

                  {hour.isOpen ? (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <TimeSelect
                        value={hour.openTime ?? '09:00'}
                        ariaLabel={`Abertura de ${getWeekdayLabel(hour.weekday)}`}
                        ariaInvalid={isInvalid}
                        ariaDescribedBy={isInvalid ? 'business-hours-error' : undefined}
                        stepMinutes={30}
                        onValueChange={(openTime) => {
                          updateHour(hour.weekday, {
                            openTime,
                            closeTime:
                              hour.closeTime && openTime >= hour.closeTime
                                ? null
                                : hour.closeTime,
                          })
                          setHoursError(null)
                          setInvalidHourWeekday(null)
                        }}
                        required
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <TimeSelect
                        value={hour.closeTime ?? ''}
                        ariaLabel={`Fechamento de ${getWeekdayLabel(hour.weekday)}`}
                        min={hour.openTime ?? '09:00'}
                        excludeMin
                        placeholder="Selecione o fechamento"
                        ariaInvalid={isInvalid}
                        ariaDescribedBy={isInvalid ? 'business-hours-error' : undefined}
                        stepMinutes={30}
                        onValueChange={(closeTime) => {
                          updateHour(hour.weekday, { closeTime })
                          setHoursError(null)
                          setInvalidHourWeekday(null)
                        }}
                        required
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
                )
              })}
            </div>
            {hoursError && (
              <p
                id="business-hours-error"
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {hoursError}
              </p>
            )}
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
