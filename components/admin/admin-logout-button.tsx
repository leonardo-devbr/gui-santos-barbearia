'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AdminLogoutButton() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function logout() {
    setIsSubmitting(true)

    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.replace('/admin/login')
      router.refresh()
      setIsSubmitting(false)
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={logout} disabled={isSubmitting}>
      {isSubmitting ? <LoaderCircle className="animate-spin" /> : <LogOut />}
      {isSubmitting ? 'Saindo...' : 'Sair'}
    </Button>
  )
}
