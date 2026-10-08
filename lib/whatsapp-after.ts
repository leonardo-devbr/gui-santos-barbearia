import 'server-only'

import { after } from 'next/server'
import { processImmediateAppointmentWhatsAppNotifications } from '@/lib/whatsapp-notifications'

export function processWhatsAppAfterResponse(appointmentId: string) {
  after(async () => {
    try {
      await processImmediateAppointmentWhatsAppNotifications(appointmentId)
    } catch {
      console.error(
        'Não foi possível processar os avisos imediatos do WhatsApp; a fila continuará disponível para o próximo processamento automático.',
      )
    }
  })
}
