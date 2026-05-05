import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TEAM_AND_CTA_SETTINGS as defaults } from '../config/teamAndCtaSettings.js'

function resolvePublicAssetUrl(url) {
  if (!url) return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

function isExternalHref(to) {
  return /^mailto:/i.test(to) || /^https?:\/\//i.test(to)
}

function CtaButton({ to, className, children }) {
  if (isExternalHref(to)) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

function TeamMemberCard({ member }) {
  const { name, role, initials, imageUrl } = member
  const src = imageUrl ? resolvePublicAssetUrl(imageUrl) : null
  const letters = (initials || name)
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  return (
    <article className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900/80 sm:h-32 sm:w-32">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-brand text-2xl text-white/90 sm:text-3xl">{letters}</span>
        )}
      </div>
      <h3 className="text-base font-medium text-white sm:text-lg">{name}</h3>
      <p className="mt-1 text-sm text-zinc-500">{role}</p>
    </article>
  )
}

export default function TeamAndCTASection() {
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/teamAndCtaSettings.js', (mod) => {
      if (mod?.TEAM_AND_CTA_SETTINGS) setSettings(mod.TEAM_AND_CTA_SETTINGS)
    })
    return undefined
  }, [])

  const { layout, intro, hero, team, teamGridClassName, cta, nav } = settings

  return (
    <section id={layout.sectionId} className={layout.sectionClassName}>
      <div className={layout.containerClassName}>
        <header
          className="animate-fade-up"
          style={{ animationDelay: `${intro.hero.delay}s` }}
        >
          <h1 className={hero.titleClassName}>{hero.title}</h1>
          <p className={hero.subtitleClassName}>{hero.subtitle}</p>
        </header>

        <div
          className={`animate-fade-up ${teamGridClassName}`}
          style={{ animationDelay: `${intro.teamGrid.delay}s` }}
        >
          {team.map((member, i) => (
            <TeamMemberCard key={`${member.name}-${i}`} member={member} />
          ))}
        </div>

        <div
          className="animate-fade-up rounded-2xl border border-white/10 bg-zinc-950/50 px-8 py-10 sm:px-12 sm:py-12"
          style={{ animationDelay: `${intro.ctaBlock.delay}s` }}
        >
          <h2 className={cta.headlineClassName}>{cta.headline}</h2>
          <p className={cta.bodyClassName}>{cta.body}</p>
          <CtaButton to={cta.to} className={cta.buttonClassName}>
            {cta.buttonText}
          </CtaButton>
        </div>

        {nav?.back && (
          <nav
            className="animate-fade-up"
            style={{ animationDelay: `${intro.nav.delay}s` }}
          >
            <Link to={nav.back.to} className={nav.back.className}>
              {nav.back.label}
            </Link>
          </nav>
        )}
      </div>
    </section>
  )
}
