import type React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { BottomNavigation } from '@/components/bottom-navigation'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <main className="flex-1">{children}</main>
      </div>
      <BottomNavigation />
    </div>
  )
}
