import { technologyBlocks } from '../content/landingContent'

export default function TechnologySection() {
  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">О технологии</h2>
      </div>
      <div className="space-y-4">
        {technologyBlocks.map((block, index) => (
          <article
            key={block.title}
            className="border-y border-white/10 bg-zinc-900/60 px-4 py-6 sm:px-6 sm:py-8"
          >
            <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-5 md:grid-cols-2">
              <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                <h3 className="text-xl font-semibold text-white">{block.title}</h3>
                <p className="mt-3 leading-relaxed text-zinc-300">{block.text}</p>
              </div>
              <img
                src={block.image}
                alt={block.title}
                className={`h-52 w-full rounded-2xl border border-white/10 object-cover object-top ${
                  index % 2 === 1 ? 'md:order-1' : ''
                }`}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
