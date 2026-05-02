function ComparisonCard({ label }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 shadow-heavy backdrop-blur-md">
      <div className="aspect-[4/5] w-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
      <span className="absolute left-5 top-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur-md">
        {label}
      </span>
    </article>
  )
}

export default function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="relative min-h-svh w-full bg-black px-6 py-24 sm:px-10 sm:py-28 lg:px-16 lg:py-32"
    >
      <div className="mx-auto flex max-w-6xl flex-col">
        <h2 className="font-brand text-5xl uppercase leading-[0.95] tracking-[0.02em] text-white sm:text-7xl lg:text-8xl">
          Заголовок
        </h2>

        <div className="mt-10 max-w-2xl space-y-3 text-base leading-relaxed text-white/70 sm:text-lg">
          <p>Первая строка описания — короткий вступительный тезис.</p>
          <p>Вторая строка — раскрываем суть подхода в одном предложении.</p>
          <p>Третья строка — финальный аккорд или приглашение посмотреть результат.</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <ComparisonCard label="До" />
          <ComparisonCard label="После" />
        </div>
      </div>
    </section>
  )
}
