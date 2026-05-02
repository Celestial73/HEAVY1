import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { faqItems } from '../content/landingContent'

export default function FaqSection() {
  const [active, setActive] = useState(0)

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">Часто задаваемые вопросы</h2>
      <div className="space-y-3">
        {faqItems.map((item, index) => {
          const opened = index === active
          return (
            <article key={item.question} className="rounded-2xl border border-white/10 bg-zinc-900/75">
              <button
                type="button"
                onClick={() => setActive(opened ? -1 : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-white sm:px-6"
              >
                <span className="text-base font-semibold sm:text-lg">{item.question}</span>
                <ChevronDown className={`h-5 w-5 transition ${opened ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-300 ${opened ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-zinc-300 sm:px-6">{item.answer}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
