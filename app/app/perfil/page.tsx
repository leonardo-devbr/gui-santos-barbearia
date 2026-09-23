import type { Metadata } from 'next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogoutButton } from '@/components/logout-button'
import { ProfileForm } from '@/components/profile/profile-form'
import { getAuthenticatedCustomer } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Meu perfil | Gui Santos Barbearia',
}

export default async function PerfilPage() {
  const currentCustomer = await getAuthenticatedCustomer()
  if (!currentCustomer) return null

  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus dados e preferências de atendimento.
        </p>
      </div>

      {/* Cabeçalho do perfil */}
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border border-border">
            <AvatarImage src={currentCustomer.photoUrl || '/placeholder.svg'} alt={currentCustomer.name} />
            <AvatarFallback className="text-lg">{currentCustomer.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-xl text-card-foreground">{currentCustomer.name}</h2>
            <p className="text-sm text-muted-foreground">{currentCustomer.email}</p>
          </div>
        </div>
        <LogoutButton variant="outline" />
      </div>

      <ProfileForm customer={currentCustomer} />
    </div>
  )
}
