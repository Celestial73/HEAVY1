import { Link, useLocation } from 'react-router-dom'
import { TEAM_AND_CTA_SETTINGS } from '../config/teamAndCtaSettings.js'

function isExternalHref(to) {
  return /^mailto:/i.test(to) || /^https?:\/\//i.test(to)
}

function CtaLink({ to, className, children }) {
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

export default function GlobalCtaButton() {
  const location = useLocation()
  const footer = TEAM_AND_CTA_SETTINGS.footer ?? {}
  const isFinalPage = location.pathname === '/team-and-cta'
  const className = [
    'inline-flex h-12 items-center justify-center rounded-full border px-6 text-xs font-semibold uppercase tracking-[0.18em] transition active:scale-[0.98] sm:px-8 sm:text-sm',
    isFinalPage
      ? 'border-white/20 bg-white text-black hover:bg-zinc-100'
      : 'border-white/25 bg-black/45 text-white backdrop-blur-md hover:bg-black/70',
  ].join(' ')
  const wrapperClassName = isFinalPage
    ? 'pointer-events-none fixed bottom-5 left-1/2 z-70 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] sm:bottom-6'
    : 'pointer-events-none fixed bottom-5 left-5 z-70 pb-[env(safe-area-inset-bottom)] sm:bottom-6 sm:left-8'

  return (
    <div className={wrapperClassName}>
      <CtaLink to={footer.to ?? '/team-and-cta'} className={`pointer-events-auto ${className}`}>
        {footer.buttonText ?? 'Заказать утяжеление'}
      </CtaLink>
    </div>
  )
}
