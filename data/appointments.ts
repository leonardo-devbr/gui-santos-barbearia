import type { Appointment } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por chamadas a GET /api/appointments.
function getNextOpenDate() {
  const todayInSaoPaulo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const date = new Date(`${todayInSaoPaulo}T12:00:00-03:00`)

  do {
    date.setUTCDate(date.getUTCDate() + 1)
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 1)

  return date.toISOString().slice(0, 10)
}

export const upcomingAppointments: Appointment[] = [
  {
    id: 'ag-001',
    serviceId: 'corte-barba',
    barberId: 'guilherme',
    date: getNextOpenDate(),
    time: '14:30',
    status: 'confirmado',
    price: 65,
    durationMinutes: 75,
  },
]

export const pastAppointments: Appointment[] = [
  {
    id: 'ag-h01',
    serviceId: 'corte-barba',
    barberId: 'guilherme',
    date: '2026-08-15',
    time: '10:00',
    status: 'concluido',
    price: 65,
    durationMinutes: 75,
  },
  {
    id: 'ag-h02',
    serviceId: 'corte',
    barberId: 'guilherme',
    date: '2026-08-01',
    time: '16:30',
    status: 'concluido',
    price: 40,
    durationMinutes: 45,
  },
  {
    id: 'ag-h03',
    serviceId: 'barba',
    barberId: 'vitor',
    date: '2026-07-18',
    time: '11:00',
    status: 'concluido',
    price: 35,
    durationMinutes: 30,
  },
  {
    id: 'ag-h04',
    serviceId: 'corte-barba',
    barberId: 'vitor',
    date: '2026-07-02',
    time: '15:00',
    status: 'cancelado',
    price: 65,
    durationMinutes: 75,
  },
]
