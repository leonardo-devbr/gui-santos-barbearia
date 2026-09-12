import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Administração | Gui Santos Barbearia',
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">VISÃO GERAL</span>
        <h1 className="font-serif text-3xl text-foreground">Painel administrativo</h1>
        <p className="text-sm text-muted-foreground">
          A autenticação está pronta. A agenda será exibida aqui na próxima etapa.
        </p>
      </div>

      <Card>
        <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="size-6" />
          </div>
          <h2 className="font-serif text-xl text-card-foreground">Agenda administrativa</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Em seguida, este espaço mostrará os horários de todos os clientes e as ações da equipe.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
