/**
 * Полноэкранный сплэш при `visible`; параметры из `src/config/sectionSplashSettings.js`.
 */
export default function SectionSplashOverlay({ splash, visible }) {
  if (!visible || !splash?.enabled) return null

  return (
    <div
      className={splash.wrapperClassName}
      aria-busy="true"
      aria-live="polite"
      aria-label={splash.ariaLabel ?? splash.label}
    >
      <div className={splash.contentClassName}>
        {splash.showSpinner !== false ? (
          <div className={splash.spinnerClassName} aria-hidden />
        ) : null}
        <div className={splash.labelClassName}>{splash.label}</div>
      </div>
    </div>
  )
}
