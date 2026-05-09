import { useEffect, useMemo, useState } from 'react'

const QUARTILE_YP = [0, 25, 50, 75, 100]
const QUARTILE_XP = [0, 25, 50, 75, 100]

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

/** Авто: к какой точке блока привязать линию xPercent (квартильная сетка). */
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

/**
 * Режим позиционирования по процентам: xPercent/yPercent + origin.
 * Возвращает null — использовать placement/corner.
 */
function resolveBandLayout(config) {
  const hasY =
    config.yPercent != null &&
    config.yPercent !== '' &&
    Number.isFinite(Number(config.yPercent))
  const hasXPercent =
    config.xPercent != null &&
    config.xPercent !== '' &&
    Number.isFinite(Number(config.xPercent))
  const hasX = config.xSide === 'left' || config.xSide === 'right'

  if (hasY || hasX || hasXPercent) {
    const yPercent = hasY ? Math.min(100, Math.max(0, Number(config.yPercent))) : 50
    const xPercent = hasXPercent
      ? Math.min(100, Math.max(0, Number(config.xPercent)))
      : hasX
        ? config.xSide === 'right'
          ? 100
          : 0
        : 0
    let { yOrigin } = config
    if (yOrigin !== 'top' && yOrigin !== 'center' && yOrigin !== 'bottom') {
      yOrigin = inferYOriginFromPercent(yPercent)
    }
    let { xOrigin } = config
    if (xOrigin !== 'left' && xOrigin !== 'center' && xOrigin !== 'right') {
      xOrigin = inferXOriginFromPercent(xPercent)
    }
    return { yPercent, xPercent, xOrigin, yOrigin }
  }

  if (config.corner === 'center-left') {
    return {
      yPercent: 50,
      xPercent: 0,
      xOrigin: 'left',
      yOrigin:
        config.yOrigin === 'top' || config.yOrigin === 'center' || config.yOrigin === 'bottom'
          ? config.yOrigin
          : 'center',
    }
  }
  if (config.corner === 'center-right') {
    return {
      yPercent: 50,
      xPercent: 100,
      xOrigin: 'right',
      yOrigin:
        config.yOrigin === 'top' || config.yOrigin === 'center' || config.yOrigin === 'bottom'
          ? config.yOrigin
          : 'center',
    }
  }
  return null
}

/** `viewport` — проценты и max-width от всего экрана; `container` — от узкой колонки (Workflow на десктопе). */
function bandLayoutStyle(band, insetPx, widthBasis = 'viewport') {
  const inset = typeof insetPx === 'number' ? insetPx : 24
  const { yPercent, xPercent, xOrigin, yOrigin } = band
  const boundedX = Math.min(100, Math.max(0, xPercent))
  let translateY = '0'
  if (yOrigin === 'center') translateY = '-50%'
  else if (yOrigin === 'bottom') translateY = '-100%'
  let translateX = '0'
  if (xOrigin === 'center') translateX = '-50%'
  else if (xOrigin === 'right') translateX = '-100%'
  const fullW = widthBasis === 'container' ? '100%' : '100vw'

  return {
    position: 'absolute',
    boxSizing: 'border-box',
    left: `${boundedX}%`,
    top: `${yPercent}%`,
    transform: `translate(${translateX}, ${translateY})`,
    maxWidth: `calc(${fullW} - ${inset * 2 + 8}px)`,
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

function ProcessSectionTextOverlayItem({
  item,
  itemDefaults,
  sceneReady,
  fadeTransitions,
  overlayWidthBasis = 'viewport',
}) {
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
    lineHeightPx,
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
    if (band) return bandLayoutStyle(band, insetPx, overlayWidthBasis)
    return placementWrapperStyle(placement, corner, insetPx, textAlign)
  }, [band, placement, corner, insetPx, textAlign, overlayWidthBasis])

  const [textOpacity, setTextOpacity] = useState(() => (fadeTransitions === false ? 1 : 0))
  const [textTransition, setTextTransition] = useState('none')

  useEffect(() => {
    if (!enabled || !text) return undefined

    if (fadeTransitions === false) {
      setTextTransition('none')
      setTextOpacity(1)
      return undefined
    }

    /** Пока сцена не готова — тексты скрыты (без вспышки «все строки сразу»). */
    if (!sceneReady) {
      setTextTransition('none')
      setTextOpacity(0)
      return undefined
    }

    const showMs = Math.max(0, (showAfterSec ?? 0) * 1000)
    const fadeIn = Math.max(0.05, fadeInSec ?? 0.5)
    const fadeOut = Math.max(0.05, fadeOutSec ?? 0.5)
    /** `null` / не число — не гасить (удобно для страниц вроде Workflow). */
    const shouldHide =
      hideAfterSec != null && typeof hideAfterSec === 'number' && Number.isFinite(hideAfterSec)
    const rawHideMs = shouldHide ? hideAfterSec * 1000 : 0
    const minHideMs = showMs + fadeIn * 1000 + 50
    const hideMs = Math.max(rawHideMs, minHideMs)

    setTextTransition('none')
    setTextOpacity(0)

    const tShow = window.setTimeout(() => {
      setTextTransition(`opacity ${fadeIn}s ease-out`)
      window.requestAnimationFrame(() => {
        setTextOpacity(1)
      })
    }, showMs)

    const tHide = shouldHide
      ? window.setTimeout(() => {
          setTextTransition(`opacity ${fadeOut}s ease-in`)
          window.requestAnimationFrame(() => {
            setTextOpacity(0)
          })
        }, hideMs)
      : null

    return () => {
      window.clearTimeout(tShow)
      if (tHide != null) window.clearTimeout(tHide)
    }
  }, [enabled, text, sceneReady, showAfterSec, fadeInSec, hideAfterSec, fadeOutSec, fadeTransitions])

  if (!enabled || !text) return null

  const insetForWidth = typeof insetPx === 'number' ? insetPx : 24
  const fullW = overlayWidthBasis === 'container' ? '100%' : '100vw'
  /** В колонке wrapper уже ограничен `bandLayoutStyle.maxWidth`; не вычитаем inset второй раз — иначе текст сужается и ломается на лишние строки. */
  const textMaxWidth =
    overlayWidthBasis === 'container'
      ? maxWidthPx != null
        ? `min(${maxWidthPx}px, 100%)`
        : '100%'
      : maxWidthPx != null
        ? `min(${maxWidthPx}px, calc(${fullW} - ${insetForWidth * 2 + 8}px))`
        : `calc(${fullW} - ${insetForWidth * 2 + 8}px)`
  const textBlockStyle = {
    fontFamily,
    fontSize: typeof fontSizePx === 'number' ? `${fontSizePx}px` : fontSizePx,
    fontWeight,
    color,
    lineHeight: lineHeightPx != null ? `${lineHeightPx}px` : lineHeight,
    letterSpacing,
    textAlign,
    maxWidth: textMaxWidth,
    whiteSpace: 'pre-line',
    textShadow: '0 1px 12px rgba(0,0,0,0.55)',
    opacity: fadeTransitions === false ? 1 : textOpacity,
    transition: fadeTransitions === false ? 'none' : textTransition,
  }

  return (
    <div style={wrapperStyle}>
      <div style={textBlockStyle}>
        {text}
      </div>
    </div>
  )
}

/**
 * Несколько текстовых оверлеев над секцией Process.
 * `sceneReady` — canvas смонтирован и WebGPU инициализирован.
 */
export default function ProcessSectionTextOverlay({
  items,
  itemDefaults,
  sceneReady,
  fadeTransitions = true,
  /**
   * Если задано (px), оверлей рисуется в центрированной колонке `max-width: N`
   * (на узком экране — на всю ширину). Проценты позиций и max-width текста считаются от колонки, не от `100vw`.
   */
  layoutColumnMaxWidth = null,
}) {
  const list = Array.isArray(items) ? items : []
  const columnPx =
    layoutColumnMaxWidth != null &&
    typeof layoutColumnMaxWidth === 'number' &&
    Number.isFinite(layoutColumnMaxWidth) &&
    layoutColumnMaxWidth > 0
      ? layoutColumnMaxWidth
      : null
  const overlayWidthBasis = columnPx != null ? 'container' : 'viewport'

  const itemsEl = list.map((item, index) => (
    <ProcessSectionTextOverlayItem
      key={item?.id != null ? String(item.id) : index}
      item={item}
      itemDefaults={itemDefaults}
      sceneReady={sceneReady}
      fadeTransitions={fadeTransitions}
      overlayWidthBasis={overlayWidthBasis}
    />
  ))

  if (columnPx == null) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
        aria-hidden="true"
      >
        {itemsEl}
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex justify-center overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="relative h-full w-full min-w-0 overflow-hidden"
        style={{ maxWidth: columnPx }}
      >
        {itemsEl}
      </div>
    </div>
  )
}
