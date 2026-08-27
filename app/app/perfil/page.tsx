import type { Metadata } from 'next'
import Link from 'next/link'
import { Gem, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ProfileForm } from '@/components/profile/profile-form'
import { currentCustomer } from '@/data/customer'
import { getCurrentTier } from '@/data/loyalty'

export const metadata: Metadata = {
  title: 'Meu perfil | Gui Santos Barbearia',
}

export default function PerfilPage() {
  const { current } = getCurrentTier(currentCustomer.loyaltyPoints)

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
            <span className="mt-1 flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Gem className="size-3" />
              Nível {current.name} · {currentCustomer.loyaltyPoints} pts
            </span>
          </div>
        </div>
        <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>

      <ProfileForm customer={currentCustomer} />
    </div>
  )
}
