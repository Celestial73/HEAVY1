/**
 * Полноэкранный сплэш при `visible`; параметры из `src/config/sectionSplashSettings.js`.
 */
function resolvePublicAssetUrl(url) {
  if (!url) return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

export default function SectionSplashOverlay({ splash, visible }) {
  const shouldShow = visible || splash?.forceVisible === true
  if (!shouldShow || !splash?.enabled) return null
  const spinnerImageUrl = splash.spinnerImageUrl
    ? resolvePublicAssetUrl(splash.spinnerImageUrl)
    : null
  const spinnerOpacity =
    splash.spinnerOpacity != null && Number.isFinite(Number(splash.spinnerOpacity))
      ? Math.min(1, Math.max(0, Number(splash.spinnerOpacity)))
      : 1

  return (
    <div
      className={splash.wrapperClassName}
      aria-busy="true"
      aria-live="polite"
      aria-label={splash.ariaLabel ?? splash.label}
    >
      <div className={splash.contentClassName}>
        {splash.showSpinner !== false ? (
          spinnerImageUrl ? (
            <img
              src={spinnerImageUrl}
              alt=""
              draggable={false}
              className={splash.spinnerClassName}
              style={{ opacity: spinnerOpacity }}
              aria-hidden
            />
          ) : (
            <div className={splash.spinnerClassName} style={{ opacity: spinnerOpacity }} aria-hidden />
          )
        ) : null}
        <div className={splash.labelClassName}>{splash.label}</div>
      </div>
    </div>
  )
}
