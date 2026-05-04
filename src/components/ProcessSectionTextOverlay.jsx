import { useEffect, useMemo, useRef } from 'react'

const QUARTILE_YP = [0, 25, 50, 75, 100]

function mergeTextOverlayItem(base, user) {
  if (!user || typeof user !== 'object') return { ...base }
  const u = { ...user }
  if (u.fontFamily == null && u.fontfamily != null) {
    u.fontFamily = u.fontfamily
    delete u.fontfamily
  }
  return { ...base, ...u }
}

/** Авто: к какой точке блока привязать линию yPercent (квартильная сетка). */
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

/**
 * Режим «полоса по Y + лево/право». Возвращает null — использовать placement/corner.
 */
function resolveBandLayout(config) {
  const hasY =
    config.yPercent != null &&
    config.yPercent !== '' &&
    Number.isFinite(Number(config.yPercent))
  const hasX = config.xSide === 'left' || config.xSide === 'right'

  if (hasY || hasX) {
    const yPercent = hasY ? Math.min(100, Math.max(0, Number(config.yPercent))) : 50
    const xSide = hasX ? config.xSide : 'left'
    let { yOrigin } = config
    if (yOrigin !== 'top' && yOrigin !== 'center' && yOrigin !== 'bottom') {
      yOrigin = inferYOriginFromPercent(yPercent)
    }
    return { yPercent, xSide, yOrigin }
  }

  if (config.corner === 'center-left') {
    return {
      yPercent: 50,
      xSide: 'left',
      yOrigin:
        config.yOrigin === 'top' || config.yOrigin === 'center' || config.yOrigin === 'bottom'
          ? config.yOrigin
          : 'center',
    }
  }
  if (config.corner === 'center-right') {
    return {
      yPercent: 50,
      xSide: 'right',
      yOrigin:
        config.yOrigin === 'top' || config.yOrigin === 'center' || config.yOrigin === 'bottom'
          ? config.yOrigin
          : 'center',
    }
  }
  return null
}

function bandLayoutStyle(band, insetPx) {
  const inset = typeof insetPx === 'number' ? insetPx : 24
  const { yPercent, xSide, yOrigin } = band
  let translateY = '0'
  if (yOrigin === 'center') translateY = '-50%'
  else if (yOrigin === 'bottom') translateY = '-100%'

  return {
    position: 'absolute',
    boxSizing: 'border-box',
    left: inset,
    right: inset,
    top: `${yPercent}%`,
    transform: `translateY(${translateY})`,
    display: 'flex',
    justifyContent: xSide === 'right' ? 'flex-end' : 'flex-start',
  }
}

function placementWrapperStyle(placement, corner, insetPx, textAlign) {
  const inset = typeof insetPx === 'number' ? insetPx : 24
  if (placement === 'center') {
    const justify =
      textAlign === 'right' ? 'flex-end' : textAlign === 'center' ? 'center' : 'flex-start'
    return {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: justify,
      padding: inset,
      boxSizing: 'border-box',
    }
  }
  const c = corner ?? 'bottom-left'
  const style = {
    position: 'absolute',
    boxSizing: 'border-box',
    maxWidth: '100%',
  }
  if (c === 'top-left') {
    style.top = inset
    style.left = inset
  } else if (c === 'top-right') {
    style.top = inset
    style.right = inset
  } else if (c === 'bottom-right') {
    style.bottom = inset
    style.right = inset
  } else if (c === 'bottom-left') {
    style.bottom = inset
    style.left = inset
  } else {
    style.bottom = inset
    style.left = inset
  }
  return style
}

function ProcessSectionTextOverlayItem({ item, itemDefaults, sceneReady }) {
  const ref = useRef(null)
  const config = useMemo(
    () => mergeTextOverlayItem(itemDefaults ?? {}, item ?? {}),
    [itemDefaults, item],
  )

  const {
    enabled,
    text,
    fontSizePx,
    fontFamily,
    fontWeight,
    color,
    lineHeight,
    letterSpacing,
    placement,
    corner,
    insetPx,
    maxWidthPx,
    textAlign,
    showAfterSec,
    fadeInSec,
    hideAfterSec,
    fadeOutSec,
  } = config

  const band = useMemo(() => resolveBandLayout(config), [config])

  const wrapperStyle = useMemo(() => {
    if (band) return bandLayoutStyle(band, insetPx)
    return placementWrapperStyle(placement, corner, insetPx, textAlign)
  }, [band, placement, corner, insetPx, textAlign])

  const insetForWidth = typeof insetPx === 'number' ? insetPx : 24
  const textBlockStyle = {
    fontFamily,
    fontSize: typeof fontSizePx === 'number' ? `${fontSizePx}px` : fontSizePx,
    fontWeight,
    color,
    lineHeight,
    letterSpacing,
    textAlign,
    maxWidth:
      maxWidthPx != null
        ? `min(${maxWidthPx}px, calc(100% - ${insetForWidth * 2 + 8}px))`
        : `calc(100% - ${insetForWidth * 2 + 8}px)`,
    whiteSpace: 'pre-line',
    textShadow: '0 1px 12px rgba(0,0,0,0.55)',
  }

  useEffect(() => {
    if (!enabled || !text || !sceneReady) return undefined
    const el = ref.current
    if (!el) return undefined

    const showMs = Math.max(0, (showAfterSec ?? 0) * 1000)
    const fadeIn = Math.max(0.05, fadeInSec ?? 0.5)
    const fadeOut = Math.max(0.05, fadeOutSec ?? 0.5)
    const rawHideMs = (hideAfterSec ?? 6) * 1000
    const minHideMs = showMs + fadeIn * 1000 + 50
    const hideMs = Math.max(rawHideMs, minHideMs)

    el.style.opacity = '0'
    el.style.transition = 'none'

    const tShow = window.setTimeout(() => {
      el.style.transition = `opacity ${fadeIn}s ease-out`
      void el.offsetHeight
      el.style.opacity = '1'
    }, showMs)

    const tHide = window.setTimeout(() => {
      el.style.transition = `opacity ${fadeOut}s ease-in`
      el.style.opacity = '0'
    }, hideMs)

    return () => {
      window.clearTimeout(tShow)
      window.clearTimeout(tHide)
      el.style.transition = 'none'
      el.style.opacity = '0'
    }
  }, [enabled, text, sceneReady, showAfterSec, fadeInSec, hideAfterSec, fadeOutSec])

  if (!enabled || !text) return null

  return (
    <div style={wrapperStyle}>
      <div ref={ref} style={textBlockStyle}>
        {text}
      </div>
    </div>
  )
}

/**
 * Несколько текстовых оверлеев над секцией Process.
 * `sceneReady` — canvas смонтирован и WebGPU инициализирован.
 */
export default function ProcessSectionTextOverlay({ items, itemDefaults, sceneReady }) {
  const list = Array.isArray(items) ? items : []

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      {list.map((item, index) => (
        <ProcessSectionTextOverlayItem
          key={item?.id != null ? String(item.id) : index}
          item={item}
          itemDefaults={itemDefaults}
          sceneReady={sceneReady}
        />
      ))}
    </div>
  )
}
