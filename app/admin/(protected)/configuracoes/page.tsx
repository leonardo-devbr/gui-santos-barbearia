import type { Metadata } from 'next'
import { AdminBusinessManager } from '@/components/admin/admin-business-manager'
import { getAdminBusinessConfiguration } from '@/lib/admin-business'

export const metadata: Metadata = {
  title: 'Configurações | Gui Santos Barbearia',
}

export default async function AdminSettingsPage() {
  const configuration = await getAdminBusinessConfiguration()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">ESTABELECIMENTO</span>
        <h1 className="font-serif text-3xl text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Atualize os dados públicos e os períodos normais de atendimento.
        </p>
      </div>
      <AdminBusinessManager initial={configuration} />
    </div>
  )
}
