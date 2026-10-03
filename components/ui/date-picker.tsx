'use client'

import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { ptBR } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDateNumeric } from '@/lib/format'
import { cn } from '@/lib/utils'

function isoToLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateToIso(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

export function DatePicker({
  id,
  name,
  value,
  min,
  max,
  className,
  onValueChange,
  dialogTitle = 'Escolha uma data',
  placeholder = 'Escolha uma data',
  allowClear = false,
  ariaInvalid,
  ariaDescribedBy,
}: {
  id?: string
  name?: string
  value: string
  min?: string
  max?: string
  className?: string
  onValueChange: (value: string) => void
  dialogTitle?: string
  placeholder?: string
  allowClear?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => (value ? isoToLocalDate(value) : undefined), [value])
  const minimum = useMemo(() => (min ? isoToLocalDate(min) : undefined), [min])
  const maximum = useMemo(() => (max ? isoToLocalDate(max) : undefined), [max])
  const disabledDates = useMemo(() => {
    const matchers: Array<{ before: Date } | { after: Date }> = []
    if (minimum) matchers.push({ before: minimum })
    if (maximum) matchers.push({ after: maximum })
    return matchers
  }, [maximum, minimum])
  const currentYear = new Date().getFullYear()

  return (
    <>
      {name && <input name={name} type="hidden" value={value} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              className={cn('justify-start gap-2 font-normal', className)}
            />
          }
        >
          <CalendarDays className="text-primary" aria-hidden="true" />
          <span className={cn(!value && 'text-muted-foreground')}>
            {value ? formatDateNumeric(value) : placeholder}
          </span>
        </DialogTrigger>
        <DialogContent className="w-auto max-w-[calc(100%-2rem)] sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Navegue pelos meses e selecione o dia desejado.
            </DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            locale={ptBR}
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected ?? maximum ?? new Date()}
            startMonth={minimum ?? new Date(currentYear - 10, 0, 1)}
            endMonth={maximum ?? new Date(currentYear + 5, 11, 31)}
            disabled={disabledDates}
            onSelect={(date) => {
              if (!date) return
              onValueChange(localDateToIso(date))
              setOpen(false)
            }}
            className="mx-auto rounded-xl border border-border bg-card p-3 shadow-xl"
          />
          {allowClear && value && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onValueChange('')
                setOpen(false)
              }}
            >
              Limpar data
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
