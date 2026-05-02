import { ArrowDown, ArrowRight } from 'lucide-react'
import { processSteps } from '../content/landingContent'

export default function ProcessSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">Процесс утяжеления</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-start">
        {processSteps.map((step, index) => (
          <div key={step.title} className="flex flex-col items-center">
            <article className="w-full rounded-3xl border border-white/10 bg-zinc-900/70 p-4 shadow-heavy">
              <img
                src={step.image}
                alt={step.title}
                className="mb-3 h-28 w-full rounded-xl object-cover object-top"
              />
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{step.subtitle}</p>
            </article>
            {index < processSteps.length - 1 ? (
              <>
                <ArrowDown className="my-3 h-5 w-5 text-zinc-400 md:hidden" />
                <ArrowRight className="my-3 hidden h-5 w-5 text-zinc-400 md:block" />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
