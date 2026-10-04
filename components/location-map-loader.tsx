'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { BusinessSettings } from '@/lib/types'

const LocationMap = dynamic(() => import('@/components/location-map').then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export function LocationMapLoader({ settings }: { settings: BusinessSettings }) {
  return (
    <LocationMap
      name={settings.name}
      street={settings.street}
      latitude={settings.latitude}
      longitude={settings.longitude}
    />
  )
}
