import type { Metadata } from 'next'
import { AdminBarbersManager } from '@/components/admin/admin-barbers-manager'
import { getAdminBarbers } from '@/lib/admin-barbers'

export const metadata: Metadata = {
  title: 'Gerenciar barbeiros | Gui Santos Barbearia',
}

export default async function AdminBarbersPage() {
  const barbers = await getAdminBarbers()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">EQUIPE</span>
        <h1 className="font-serif text-3xl text-foreground">Barbeiros</h1>
        <p className="text-sm text-muted-foreground">
          Mantenha os perfis profissionais e a disponibilidade da equipe.
        </p>
      </div>

      <AdminBarbersManager initial={barbers} />
    </div>
  )
}
