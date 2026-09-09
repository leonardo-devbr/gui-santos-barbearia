'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-3xl text-foreground">Não foi possível carregar esta página</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ocorreu um erro inesperado. Tente novamente ou volte ao início da sua área.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            Tentar novamente
          </Button>
          <Button variant="outline" render={<Link href="/app" />} nativeButton={false}>
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  )
}
