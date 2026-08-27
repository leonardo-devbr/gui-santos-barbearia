import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/landing/hero"
import { ServicesSection } from "@/components/landing/services-section"
import { BarbersSection } from "@/components/landing/barbers-section"
import { ExperienceSection } from "@/components/landing/experience-section"
import { ReviewsSection } from "@/components/landing/reviews-section"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ServicesSection />
        <ExperienceSection />
        <BarbersSection />
        <ReviewsSection />
      </main>
      <SiteFooter />
    </div>
  )
}
