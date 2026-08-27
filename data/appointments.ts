import type { Appointment } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por chamadas a GET /api/appointments.
export const upcomingAppointments: Appointment[] = [
  {
    id: 'ag-001',
    serviceId: 'corte-barba',
    barberId: 'guilherme',
    date: '2026-08-22',
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

// Horários mockados de um dia — usados na etapa 4 do fluxo de agendamento.
export const mockTimeSlots = [
  { time: '09:00', available: true },
  { time: '09:30', available: false },
  { time: '10:00', available: true },
  { time: '10:30', available: true },
  { time: '11:00', available: false },
  { time: '11:30', available: true },
  { time: '13:00', available: true },
  { time: '13:30', available: true },
  { time: '14:00', available: false },
  { time: '14:30', available: true },
  { time: '15:00', available: true },
  { time: '15:30', available: true },
  { time: '16:00', available: false },
  { time: '16:30', available: true },
  { time: '17:00', available: true },
  { time: '17:30', available: true },
]
