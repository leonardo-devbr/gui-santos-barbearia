import type { Metadata } from 'next'
import { AdminUsersManager } from '@/components/admin/admin-users-manager'
import { requireAdminPageAccess } from '@/lib/admin-page-access'
import { getAdminBarbers } from '@/lib/admin-barbers'
import { getStaffAccounts } from '@/lib/admin-users'

export const metadata: Metadata = {
  title: 'Acessos da equipe | Gui Santos Barbearia',
}

export default async function AdminUsersPage() {
  await requireAdminPageAccess()
  const [users, barbers] = await Promise.all([getStaffAccounts(), getAdminBarbers()])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">ACESSO</span>
        <h1 className="font-serif text-3xl text-foreground">Acessos da equipe</h1>
        <p className="text-sm text-muted-foreground">
          Defina os administradores e vincule cada barbeiro à própria agenda.
        </p>
      </div>
      <AdminUsersManager initial={users} barbers={barbers} />
    </div>
  )
}
