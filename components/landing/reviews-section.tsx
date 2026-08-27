import { Star } from 'lucide-react'
import { reviews } from '@/data/customer'

export function ReviewsSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-[0.3em] text-primary">CLIENTES</span>
        <h2 className="font-serif text-balance text-4xl text-foreground sm:text-5xl">Avaliações</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {reviews.map((review) => (
          <div key={review.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-4 ${i < review.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{review.comment}&rdquo;</p>
            <span className="mt-auto text-sm font-medium text-card-foreground">{review.customerName}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
