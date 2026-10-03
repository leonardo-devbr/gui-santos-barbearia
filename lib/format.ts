export function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

const monthAbbrev = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
]

const monthFull = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// Espera datas no formato ISO 'YYYY-MM-DD'.
export function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${monthAbbrev[m - 1]} ${y}`
}

export function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${monthFull[m - 1]} de ${y}`
}

export function formatDateNumeric(iso: string) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function formatMonthYear(iso: string) {
  const [year, month] = iso.split('-').map(Number)
  const label = monthFull[month - 1] ?? ''
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} de ${year}`
}

export function formatDateWeekday(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' })
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}
