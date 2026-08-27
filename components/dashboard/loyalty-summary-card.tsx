import Link from 'next/link'
import { Gem } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { getCurrentTier } from '@/data/loyalty'

interface LoyaltySummaryCardProps {
  points: number
}

