import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/landing/hero"
import { ServicesSection } from "@/components/landing/services-section"
import { BarbersSection } from "@/components/landing/barbers-section"
import { ExperienceSection } from "@/components/landing/experience-section"
import { ReviewsSection } from "@/components/landing/reviews-section"
import { getBarbers, getServices } from "@/lib/catalog"

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [services, barbers] = await Promise.all([getServices(), getBarbers()])

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ServicesSection services={services} />
        <ExperienceSection />
        <BarbersSection barbers={barbers} />
        <ReviewsSection />
      </main>
      <SiteFooter />
    </div>
  )
}
