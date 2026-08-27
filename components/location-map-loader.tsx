'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const LocationMap = dynamic(() => import('@/components/location-map').then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export function LocationMapLoader() {
  return <LocationMap />
}
