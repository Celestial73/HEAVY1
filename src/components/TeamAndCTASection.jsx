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

function PortraitBlock({
  portrait,
  frameClassName,
  frameHeightVh,
  frameWidthVw,
  frameMaxWidthPx,
  frameAspectRatio,
  frameMaxHeightVh,
  alignSide,
}) {
  const { imageUrl, imageAlt, caption, captionClassName } = portrait
  const src = imageUrl ? resolvePublicAssetUrl(imageUrl) : null
  if (!src) return null

  const h = typeof frameHeightVh === 'number' && Number.isFinite(frameHeightVh) ? frameHeightVh : 20
  const w = typeof frameWidthVw === 'number' && Number.isFinite(frameWidthVw) ? frameWidthVw : 60
  const maxPx =
    typeof frameMaxWidthPx === 'number' && Number.isFinite(frameMaxWidthPx) && frameMaxWidthPx > 0
      ? frameMaxWidthPx
      : null
  const figureWidth = maxPx != null ? `min(${w}vw, ${maxPx}px)` : `${w}vw`
  const useAspect = typeof frameAspectRatio === 'string' && frameAspectRatio.trim().length > 0
  const maxHvh =
    typeof frameMaxHeightVh === 'number' && Number.isFinite(frameMaxHeightVh) ? frameMaxHeightVh : null

  const frameStyle = useAspect
    ? {
        aspectRatio: frameAspectRatio.trim(),
        width: '100%',
        maxHeight: maxHvh != null ? `${maxHvh}vh` : undefined,
      }
    : { width: '100%', height: `${h}vh` }

  const figureAlign =
    alignSide === 'right' ? 'ml-auto items-end' : alignSide === 'left' ? 'mr-auto items-start' : 'mx-auto items-center'
  const captionAlign =
    alignSide === 'right' ? 'text-right' : alignSide === 'left' ? 'text-left' : 'text-center'

  return (
    <figure
      className={`flex max-w-full flex-col ${figureAlign}`}
      style={{ width: figureWidth }}
    >
      <div className={frameClassName} style={frameStyle}>
        <img
          src={src}
          alt={imageAlt ?? ''}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      {caption ? (
        <figcaption className={`w-full ${captionAlign} ${captionClassName ?? ''}`}>{caption}</figcaption>
      ) : null}
    </figure>
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

  const {
    layout,
    intro,
    hero,
    portraits,
    portraitsStripClassName,
    portraitFrameClassName,
    portraitHeightVh,
    portraitWidthVw,
    portraitMaxWidthPx,
    portraitAspectRatio,
    portraitMaxHeightVh,
    portraitAlternateSides,
    footer,
    nav,
  } = settings

  const portraitList = Array.isArray(portraits) ? portraits : []

  return (
    <section id={layout.sectionId} className={`${layout.sectionClassName} overflow-x-hidden`}>
      <div className={layout.containerClassName}>
        <header
          className="animate-fade-up"
          style={{ animationDelay: `${intro.hero.delay}s` }}
        >
          <h1 className={hero.titleClassName}>{hero.title}</h1>
          {hero.subtitle ? (
            <p className={hero.subtitleClassName}>{hero.subtitle}</p>
          ) : null}
        </header>

        <div
          className="animate-fade-up relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2"
          style={{ animationDelay: `${intro.portraits.delay}s` }}
        >
          <div className={`${portraitsStripClassName} px-6 sm:px-10`}>
            {portraitList.map((portrait, i) => {
              const alternate = portraitAlternateSides !== false
              const alignSide = alternate ? (i % 2 === 0 ? 'right' : 'left') : 'center'
              return (
                <PortraitBlock
                  key={`${portrait.imageUrl}-${i}`}
                  portrait={portrait}
                  frameClassName={portraitFrameClassName}
                  frameHeightVh={portraitHeightVh}
                  frameWidthVw={portraitWidthVw}
                  frameMaxWidthPx={portraitMaxWidthPx}
                  frameAspectRatio={portraitAspectRatio}
                  frameMaxHeightVh={portraitMaxHeightVh}
                  alignSide={alignSide}
                />
              )
            })}
          </div>
        </div>

        <footer
          className="animate-fade-up mt-auto flex flex-col items-center gap-10 pt-4"
          style={{ animationDelay: `${intro.footer.delay}s` }}
        >
          <CtaButton to={footer.to} className={footer.buttonClassName}>
            {footer.buttonText}
          </CtaButton>

          {nav?.back ? (
            <nav
              className="animate-fade-up"
              style={{ animationDelay: `${intro.nav.delay}s` }}
            >
              <Link to={nav.back.to} className={nav.back.className}>
                {nav.back.label}
              </Link>
            </nav>
          ) : null}
        </footer>
      </div>
    </section>
  )
}
