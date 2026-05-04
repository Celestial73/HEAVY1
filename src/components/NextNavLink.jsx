import { Link } from 'react-router-dom'

/**
 * Кнопка-ссылка «вперёд»: настраиваемый текст + стрелка.
 * Стили задаются снаружи через `className` / `style` (как у обычного Link).
 */
export default function NextNavLink({ to, ariaLabel, className, style, children }) {
  return (
    <Link to={to} aria-label={ariaLabel} className={className} style={style}>
      {children}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
