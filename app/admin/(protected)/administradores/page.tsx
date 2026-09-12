import type { Metadata } from 'next'
import { AdminUsersManager } from '@/components/admin/admin-users-manager'
import { getAdminUsers } from '@/lib/admin-users'

export const metadata: Metadata = {
  title: 'Administradores | Gui Santos Barbearia',
}

export default async function AdminUsersPage() {
  const users = await getAdminUsers()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">ACESSO</span>
        <h1 className="font-serif text-3xl text-foreground">Administradores</h1>
        <p className="text-sm text-muted-foreground">
          Controle quem pode acessar e alterar a operação da barbearia.
        </p>
      </div>
      <AdminUsersManager initial={users} />
    </div>
  )
}
