import { useEffect, useState } from 'react'
import { TEAM_AND_CTA_SETTINGS as defaults } from '../config/teamAndCtaSettings.js'
import { toCssLength } from '../utils/cssLength.js'

const QUARTILE_YP = [0, 25, 50, 75, 100]
const QUARTILE_XP = [0, 25, 50, 75, 100]

function inferYOriginFromPercent(yPercent) {
  let nearest = QUARTILE_YP[0]
  let best = Math.abs(yPercent - nearest)
  for (const q of QUARTILE_YP) {
    const d = Math.abs(yPercent - q)
    if (d < best) {
      best = d
      nearest = q
    }
  }
  if (nearest <= 25) return 'top'
  if (nearest >= 75) return 'bottom'
  return 'center'
}

function inferXOriginFromPercent(xPercent) {
  let nearest = QUARTILE_XP[0]
  let best = Math.abs(xPercent - nearest)
  for (const q of QUARTILE_XP) {
    const d = Math.abs(xPercent - q)
    if (d < best) {
      best = d
      nearest = q
    }
  }
  if (nearest <= 25) return 'left'
  if (nearest >= 75) return 'right'
  return 'center'
}

const WIDTH_VW_FALLBACK = 60

/**
 * `widthVw`: число или mobile-first объект (как Tailwind): `default`/`base`, `sm`, `md`, `lg`, `xl`, `2xl`.
 * Пороги: sm 640, md 768, lg 1024, xl 1280, 2xl 1536 (px).
 */
function resolveWidthVwFromSpec(spec, innerWidth, fallback = WIDTH_VW_FALLBACK) {
  if (typeof spec === 'number' && Number.isFinite(spec)) return spec
  if (!spec || typeof spec !== 'object') return fallback

  const base = spec.default ?? spec.base
  let v = typeof base === 'number' && Number.isFinite(base) ? base : fallback
  if (innerWidth >= 640 && typeof spec.sm === 'number' && Number.isFinite(spec.sm)) v = spec.sm
  if (innerWidth >= 768 && typeof spec.md === 'number' && Number.isFinite(spec.md)) v = spec.md
  if (innerWidth >= 1024 && typeof spec.lg === 'number' && Number.isFinite(spec.lg)) v = spec.lg
  if (innerWidth >= 1280 && typeof spec.xl === 'number' && Number.isFinite(spec.xl)) v = spec.xl
  if (innerWidth >= 1536 && typeof spec['2xl'] === 'number' && Number.isFinite(spec['2xl'])) v = spec['2xl']
  return v
}

function portraitPositionStyle(portrait, insetPx) {
  const inset = typeof insetPx === 'number' && Number.isFinite(insetPx) ? insetPx : 24
  const hasY =
    portrait?.yPercent != null &&
    portrait?.yPercent !== '' &&
    Number.isFinite(Number(portrait?.yPercent))
  const hasX =
    portrait?.xPercent != null &&
    portrait?.xPercent !== '' &&
    Number.isFinite(Number(portrait?.xPercent))

  const yPercent = hasY ? Math.min(100, Math.max(0, Number(portrait.yPercent))) : 50
  const xPercent = hasX ? Math.min(100, Math.max(0, Number(portrait.xPercent))) : 50

  let yOrigin = portrait?.yOrigin
  if (yOrigin !== 'top' && yOrigin !== 'center' && yOrigin !== 'bottom') {
    yOrigin = inferYOriginFromPercent(yPercent)
  }
  let xOrigin = portrait?.xOrigin
  if (xOrigin !== 'left' && xOrigin !== 'center' && xOrigin !== 'right') {
    xOrigin = inferXOriginFromPercent(xPercent)
  }

  const boundedX = Math.min(100, Math.max(0, xPercent))
  const boundedY = Math.min(100, Math.max(0, yPercent))

  let translateY = '0'
  if (yOrigin === 'center') translateY = '-50%'
  else if (yOrigin === 'bottom') translateY = '-100%'
  let translateX = '0'
  if (xOrigin === 'center') translateX = '-50%'
  else if (xOrigin === 'right') translateX = '-100%'

  return {
    position: 'absolute',
    left: `${boundedX}%`,
    top: `${boundedY}%`,
    transform: `translate(${translateX}, ${translateY})`,
    /** Безопасная зона от краёв viewport. */
    paddingLeft: inset,
    paddingRight: inset,
    boxSizing: 'border-box',
    maxWidth: `calc(100vw - ${inset * 2}px)`,
  }
}

function resolvePublicAssetUrl(url) {
  if (!url) return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

function resolvePortraitWidth(portrait, viewportWidth) {
  const widthClamp = toCssLength(portrait?.width)
  const maxWidthCss =
    toCssLength(portrait?.maxWidth) ??
    (typeof portrait?.maxWidthPx === 'number' &&
    Number.isFinite(portrait.maxWidthPx) &&
    portrait.maxWidthPx > 0
      ? `${portrait.maxWidthPx}px`
      : null)

  if (widthClamp) {
    return maxWidthCss ? `min(${widthClamp}, ${maxWidthCss})` : widthClamp
  }

  const w = resolveWidthVwFromSpec(portrait?.widthVw, viewportWidth, WIDTH_VW_FALLBACK)
  const legacy = `${w}vw`
  return maxWidthCss ? `min(${legacy}, ${maxWidthCss})` : legacy
}

function PortraitBlock({ portrait, frameClassName, stageInsetPx, animationDelaySec }) {
  const { imageUrl, imageAlt, caption, captionClassName } = portrait ?? {}
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  )

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const src = imageUrl ? resolvePublicAssetUrl(imageUrl) : null
  if (!src) return null

  const figureWidth = resolvePortraitWidth(portrait, viewportWidth)

  const useAspect = typeof portrait?.aspectRatio === 'string' && portrait.aspectRatio.trim().length > 0
  const heightVh =
    typeof portrait?.heightVh === 'number' && Number.isFinite(portrait.heightVh) ? portrait.heightVh : null
  const maxHeightCss =
    toCssLength(portrait?.maxHeight) ??
    (typeof portrait?.maxHeightVh === 'number' && Number.isFinite(portrait.maxHeightVh)
      ? `${portrait.maxHeightVh}vh`
      : undefined)

  const frameStyle = useAspect
    ? {
        aspectRatio: portrait.aspectRatio.trim(),
        width: '100%',
        maxHeight: maxHeightCss,
      }
    : {
        width: '100%',
        height: toCssLength(portrait?.height) ?? (heightVh != null ? `${heightVh}vh` : '20vh'),
      }

  const posStyle = portraitPositionStyle(portrait, stageInsetPx)
  const captionAlign =
    portrait?.xOrigin === 'right'
      ? 'text-right'
      : portrait?.xOrigin === 'center'
        ? 'text-center'
        : 'text-left'

  const fit =
    portrait?.objectFit === 'cover' || portrait?.objectFit === 'contain' || portrait?.objectFit === 'fill'
      ? portrait.objectFit
      : 'contain'

  const spaceBelowCaptionCss =
    toCssLength(portrait?.spaceBelowCaption) ??
    (typeof portrait?.spaceBelowCaptionVh === 'number' && Number.isFinite(portrait.spaceBelowCaptionVh)
      ? `${portrait.spaceBelowCaptionVh}vh`
      : undefined)

  const captionFontSize = toCssLength(portrait?.captionFontSize)

  const delayS =
    typeof animationDelaySec === 'number' && Number.isFinite(animationDelaySec) ? animationDelaySec : 0

  /**
   * `animate-fade-up` анимирует `transform` — нельзя вешать на тот же узел, что и позиционирование
   * с `translate(...)` (right-origin + left:100% иначе уезжает за экран и портрет «пропадает»).
   */
  return (
    <div
      style={{
        ...posStyle,
        width: figureWidth,
        marginBottom: spaceBelowCaptionCss != null && !caption ? spaceBelowCaptionCss : undefined,
      }}
    >
      <div className="animate-fade-up w-full" style={{ animationDelay: `${delayS}s` }}>
        <figure className="flex max-w-full flex-col">
          <div className={frameClassName} style={frameStyle}>
            <img
              src={src}
              alt={imageAlt ?? ''}
              className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : fit === 'fill' ? 'object-fill' : 'object-contain'}`}
              loading="lazy"
              decoding="async"
            />
          </div>
          {caption ? (
            <figcaption
              className={`w-full ${captionAlign} ${captionClassName ?? ''}`}
              style={{
                ...(captionFontSize ? { fontSize: captionFontSize } : {}),
                ...(spaceBelowCaptionCss != null ? { marginBottom: spaceBelowCaptionCss } : {}),
              }}
            >
              {caption}
            </figcaption>
          ) : null}
        </figure>
      </div>
    </div>
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
    portraitFrameClassName,
    portraitsStageClassName,
    portraitsStageInsetPx,
  } = settings

  const portraitList = Array.isArray(portraits) ? portraits : []
  const portraitIntro = intro.portraits ?? { delay: 0.85, staggerSec: 0 }
  const portraitBaseDelay =
    typeof portraitIntro.delay === 'number' && Number.isFinite(portraitIntro.delay)
      ? portraitIntro.delay
      : 0.85
  const portraitStagger =
    typeof portraitIntro.staggerSec === 'number' && Number.isFinite(portraitIntro.staggerSec)
      ? portraitIntro.staggerSec
      : 0

  const containerPaddingBottom = toCssLength(layout.containerPaddingBottom)
  const titleFontSize = toCssLength(hero?.titleFontSize)
  const subtitleFontSize = toCssLength(hero?.subtitleFontSize)

  return (
    <section id={layout.sectionId} className={layout.sectionClassName}>
      <div
        className={layout.containerClassName}
        style={containerPaddingBottom ? { paddingBottom: containerPaddingBottom } : undefined}
      >
        <div className={portraitsStageClassName}>
          {portraitList.map((portrait, i) => {
            const ownDelay = portrait?.delay
            const animationDelaySec =
              typeof ownDelay === 'number' && Number.isFinite(ownDelay)
                ? ownDelay
                : portraitBaseDelay + i * portraitStagger
            return (
              <PortraitBlock
                key={`${portrait?.imageUrl ?? 'portrait'}-${i}`}
                portrait={portrait}
                frameClassName={portraitFrameClassName}
                stageInsetPx={portraitsStageInsetPx}
                animationDelaySec={animationDelaySec}
              />
            )
          })}
        </div>

        {hero?.enabled !== false ? (
          <header className="pointer-events-none absolute left-0 top-0 z-10 px-6 pt-2 sm:px-10 sm:pt-12">
            <div className="animate-fade-up" style={{ animationDelay: `${intro.hero.delay}s` }}>
              <h1
                className={hero.titleClassName}
                style={titleFontSize ? { fontSize: titleFontSize } : undefined}
              >
                {hero.title}
              </h1>
              {hero.subtitle ? (
                <p
                  className={hero.subtitleClassName}
                  style={subtitleFontSize ? { fontSize: subtitleFontSize } : undefined}
                >
                  {hero.subtitle}
                </p>
              ) : null}
            </div>
          </header>
        ) : null}
      </div>
    </section>
  )
}
