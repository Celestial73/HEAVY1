import { Link, useLocation } from 'react-router-dom'
import { TEAM_AND_CTA_SETTINGS } from '../config/teamAndCtaSettings.js'
import { toCssLength } from '../utils/cssLength.js'

function isExternalHref(to) {
  return /^mailto:/i.test(to) || /^https?:\/\//i.test(to)
}

function CtaLink({ to, className, style, children }) {
  if (isExternalHref(to)) {
    return (
      <a href={to} className={className} style={style}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={className} style={style}>
      {children}
    </Link>
  )
}

export default function GlobalCtaButton() {
  const location = useLocation()
  const footer = TEAM_AND_CTA_SETTINGS.footer ?? {}
  const isFinalPage = location.pathname === '/portfolio'
  const buttonFontSize = toCssLength(footer.buttonFontSize)
  const className = isFinalPage
    ? (footer.buttonClassName ??
      'inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-white/20 bg-white px-4 font-bold uppercase tracking-[0.22em]  text-black transition hover:bg-zinc-100 active:scale-[0.98] sm:px-8')
    : [
        'inline-flex h-12 max-w-[calc(100vw-1.5rem)] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 font-bold uppercase tracking-[0.22em] transition active:scale-[0.98] sm:px-6 sm:tracking-[0.16em]',
        'border-white/25 bg-black/45 text-white backdrop-blur-md hover:bg-black/70 text-l sm:text-m',
      ].join(' ')
  const wrapperClassName = isFinalPage
    ? 'pointer-events-none fixed bottom-5 left-1/2 z-70 -translate-x-1/2 pb-[env(safe-area-inset-bottom)] sm:bottom-6'
    : 'pointer-events-none fixed bottom-5 left-5 z-70 pb-[env(safe-area-inset-bottom)] sm:bottom-6 sm:left-8'

  return (
    <div className={wrapperClassName}>
      <CtaLink
        to={footer.to ?? '/team-and-cta'}
        className={`pointer-events-auto ${className}`}
        style={buttonFontSize ? { fontSize: buttonFontSize } : undefined}
      >
        {footer.buttonText ?? 'Заказать утяжеление'}
      </CtaLink>
    </div>
  )
}
