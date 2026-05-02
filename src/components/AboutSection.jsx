import { aboutLines } from '../content/landingContent'

export default function AboutSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-heavy sm:p-10">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Об утяжелении</h2>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-zinc-200">
          {aboutLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
