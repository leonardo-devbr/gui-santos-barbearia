import type { Metadata } from 'next'
import { AdminServicesManager } from '@/components/admin/admin-services-manager'
import { getAdminServices } from '@/lib/admin-services'

export const metadata: Metadata = {
  title: 'Gerenciar serviços | Gui Santos Barbearia',
}

export default async function AdminServicesPage() {
  const services = await getAdminServices()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">CATÁLOGO</span>
        <h1 className="font-serif text-3xl text-foreground">Serviços e preços</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre serviços, ajuste duração e preço ou retire opções do agendamento.
        </p>
      </div>

      <AdminServicesManager initial={services} />
    </div>
  )
}
