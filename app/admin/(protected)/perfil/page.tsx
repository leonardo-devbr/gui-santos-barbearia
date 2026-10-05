import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BarberProfileForm } from '@/components/admin/barber-profile-form'
import { requireStaffPageAccess } from '@/lib/admin-page-access'
import { getBarberProfile } from '@/lib/barber-profile'

export const metadata: Metadata = {
  title: 'Meu perfil profissional | Gui Santos Barbearia',
}

export default async function BarberProfilePage() {
  const staff = await requireStaffPageAccess()
  if (staff.role !== 'barber') redirect('/admin')
  const profile = await getBarberProfile(staff)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">MEUS DADOS</span>
        <h1 className="font-serif text-3xl text-foreground">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize sua apresentação, contato profissional e senha de acesso.
        </p>
      </div>

      <BarberProfileForm profile={profile} />
    </div>
  )
}
