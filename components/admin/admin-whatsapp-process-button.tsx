'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ProcessResponse {
  message?: string
}

export function AdminWhatsAppProcessButton() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function processPendingNotifications() {
    setIsProcessing(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/notificacoes/processar', {
        method: 'POST',
        credentials: 'include',
      })
      const result = (await response.json().catch(() => null)) as ProcessResponse | null
      const message = result?.message ?? 'Não foi possível processar os avisos agora.'

      if (!response.ok) {
        setFeedback(message)
        toast.error(message)
        return
      }

      setFeedback(message)
      toast.success(message)
      router.refresh()
    } catch {
      const message = 'Não foi possível conectar ao servidor. Tente novamente.'
      setFeedback(message)
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" size="lg" onClick={processPendingNotifications} disabled={isProcessing}>
        {isProcessing ? <LoaderCircle className="animate-spin" /> : <Send />}
        {isProcessing ? 'Processando...' : 'Processar pendentes agora'}
      </Button>
      {feedback && (
        <p className="max-w-md text-xs text-muted-foreground sm:text-right" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  )
}
