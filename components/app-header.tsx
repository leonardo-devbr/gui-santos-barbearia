import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { currentCustomer } from '@/data/customer'

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-4 lg:hidden">
      <div className="flex flex-col">
        <span className="text-[10px] font-medium tracking-[0.2em] text-primary">GUI SANTOS BARBEARIA</span>
        <h1 className="font-serif text-lg text-foreground">{title}</h1>
      </div>
      <Link href="/app/perfil">
        <Avatar className="size-9 border border-border">
          <AvatarImage src={currentCustomer.photoUrl || '/placeholder.svg'} alt={currentCustomer.name} />
          <AvatarFallback>{currentCustomer.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </Link>
    </header>
  )
}
