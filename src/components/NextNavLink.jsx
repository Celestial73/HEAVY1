import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'

/**
 * Фиксированная кнопка «вперёд» на уровне глобального CTA.
 * Текст children не рендерим: визуально только белый круг с чёрной стрелкой.
 */
export default function NextNavLink({ to, ariaLabel, style }) {
  const link = (
    <Link
      to={to}
      aria-label={ariaLabel}
      className="pointer-events-auto fixed bottom-5 right-5 z-70 inline-flex h-12 w-12 animate-fade-up items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:bg-zinc-100 active:scale-95 sm:bottom-6 sm:right-8"
      style={style}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    </Link>
  )

  return typeof document === 'undefined' ? link : createPortal(link, document.body)
}
