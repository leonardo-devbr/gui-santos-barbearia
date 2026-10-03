'use client'

import { cn } from '@/lib/utils'

export const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export function TimeSelect({
  id,
  name,
  value,
  min,
  excludeMin = false,
  placeholder = 'Selecione',
  required,
  disabled,
  ariaLabel,
  className,
  onValueChange,
}: {
  id?: string
  name?: string
  value: string
  min?: string
  excludeMin?: boolean
  placeholder?: string
  required?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
  onValueChange: (value: string) => void
}) {
  const availableOptions = min
    ? timeOptions.filter((time) => (excludeMin ? time > min : time >= min))
    : timeOptions

  return (
    <select
      id={id}
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onValueChange(event.target.value)}
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {availableOptions.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  )
}
