'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  className?: string
  variant?: 'ghost' | 'outline'
}

interface LogoutResponse {
  message?: string
}

export function LogoutButton({ className, variant = 'ghost' }: LogoutButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogout() {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      const result = (await response.json().catch(() => null)) as LogoutResponse | null

      if (!response.ok) {
        toast.error(result?.message ?? 'Não foi possível encerrar sua sessão. Tente novamente.')
        return
      }

      toast.success('Sessão encerrada com segurança.')
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleLogout}
      disabled={isSubmitting}
      className={cn(className)}
    >
      {isSubmitting ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      {isSubmitting ? 'Saindo...' : 'Sair'}
    </Button>
  )
}
