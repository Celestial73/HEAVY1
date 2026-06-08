/**
 * Позиционирование блоков портфолио.
 *
 * Плоские поля (как раньше):
 *  - `xPercent` — % ширины сцены (< 0 и > 100 — за краями viewport)
 *
 * Responsive — вариант 1, объект `position`:
 *  - `position: { default: { xPercent: 5, yPercent: 40 }, md: { xPercent: 0, yPercent: 30 } }`
 *  - поля верхнего уровня = default, `position.md` перекрывает на ≥768px
 *
 * Responsive — вариант 2, по полям:
 *  - `xPercent: { default: 5, md: 0 }`, `yPercent: { default: 40, md: 30 }`
 */

export const PORTFOLIO_POSITION_BREAKPOINTS = [
  'default',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
]

const QUARTILE = [0, 25, 50, 75, 100]

function inferOriginFromPercent(value, axis) {
  let nearest = QUARTILE[0]
  let best = Math.abs(value - nearest)
  for (const q of QUARTILE) {
    const d = Math.abs(value - q)
    if (d < best) {
      best = d
      nearest = q
    }
  }
  if (axis === 'x') {
    if (nearest <= 25) return 'left'
    if (nearest >= 75) return 'right'
    return 'center'
  }
  if (nearest <= 25) return 'top'
  if (nearest >= 75) return 'bottom'
  return 'center'
}

function inferXOriginFromPercent(xPercent) {
  if (xPercent < 0) return 'left'
  if (xPercent > 100) return 'right'
  return inferOriginFromPercent(xPercent, 'x')
}

function toFiniteNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isResponsiveScalarSpec(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    PORTFOLIO_POSITION_BREAKPOINTS.some((bp) => value[bp] != null || (bp === 'default' && value.base != null))
  )
}

function hasResponsivePositionFields(block) {
  return (
    isResponsiveScalarSpec(block?.xPercent) ||
    isResponsiveScalarSpec(block?.yPercent) ||
    isResponsiveScalarSpec(block?.xOrigin) ||
    isResponsiveScalarSpec(block?.yOrigin)
  )
}

function hasResponsivePositionObject(block) {
  if (!block?.position || typeof block.position !== 'object' || Array.isArray(block.position)) {
    return false
  }
  return PORTFOLIO_POSITION_BREAKPOINTS.some(
    (bp) => block.position[bp] != null || (bp === 'default' && block.position.base != null),
  )
}

function scalarAtBreakpoint(spec, breakpoint) {
  if (!isResponsiveScalarSpec(spec)) return spec
  let value = spec.default ?? spec.base
  for (const bp of PORTFOLIO_POSITION_BREAKPOINTS) {
    if (spec[bp] != null) value = spec[bp]
    if (bp === breakpoint) break
  }
  return value
}

function flatPositionAtBreakpoint(block, breakpoint) {
  return {
    xPercent: scalarAtBreakpoint(block?.xPercent, breakpoint),
    yPercent: scalarAtBreakpoint(block?.yPercent, breakpoint),
    xOrigin: scalarAtBreakpoint(block?.xOrigin, breakpoint),
    yOrigin: scalarAtBreakpoint(block?.yOrigin, breakpoint),
  }
}

function resolvePositionSnapshot(raw) {
  const xPercent = toFiniteNumber(raw?.xPercent, 50)
  const yPercent = toFiniteNumber(raw?.yPercent, 0)

  let yOrigin = raw?.yOrigin
  if (yOrigin !== 'top' && yOrigin !== 'center' && yOrigin !== 'bottom') {
    yOrigin = inferOriginFromPercent(Math.min(100, Math.max(0, yPercent % 100 || yPercent)), 'y')
  }

  let xOrigin = raw?.xOrigin
  if (xOrigin !== 'left' && xOrigin !== 'center' && xOrigin !== 'right') {
    xOrigin = inferXOriginFromPercent(xPercent)
  }

  let translateY = '0'
  if (yOrigin === 'center') translateY = '-50%'
  else if (yOrigin === 'bottom') translateY = '-100%'

  let translateX = '0'
  if (xOrigin === 'center') translateX = '-50%'
  else if (xOrigin === 'right') translateX = '-100%'

  return {
    xPercent,
    yPercent,
    xOrigin,
    yOrigin,
    left: `${xPercent}%`,
    top: `${yPercent}vh`,
    translateX,
    translateY,
    transform: `translate(${translateX}, ${translateY})`,
  }
}

/**
 * Слои позиции mobile-first для каждого брейкпоинта.
 * @returns {Record<string, ReturnType<typeof resolvePositionSnapshot>>}
 */
export function buildPortfolioPositionLayers(block) {
  if (hasResponsivePositionObject(block)) {
    let acc = flatPositionAtBreakpoint(block, 'default')
    acc = { ...acc, ...(block.position.default ?? block.position.base ?? {}) }

    const layers = { default: resolvePositionSnapshot(acc) }

    for (const bp of PORTFOLIO_POSITION_BREAKPOINTS.slice(1)) {
      if (block.position[bp]) acc = { ...acc, ...block.position[bp] }
      layers[bp] = resolvePositionSnapshot(acc)
    }

    return layers
  }

  if (hasResponsivePositionFields(block)) {
    const layers = {}
    for (const bp of PORTFOLIO_POSITION_BREAKPOINTS) {
      layers[bp] = resolvePositionSnapshot(flatPositionAtBreakpoint(block, bp))
    }
    return layers
  }

  return { default: resolvePositionSnapshot(flatPositionAtBreakpoint(block, 'default')) }
}

export function portfolioBlockUsesResponsivePosition(block) {
  const layers = buildPortfolioPositionLayers(block)
  if (Object.keys(layers).length <= 1) return false

  const base = layers.default
  return PORTFOLIO_POSITION_BREAKPOINTS.slice(1).some((bp) => {
    const layer = layers[bp]
    if (!layer) return false
    return (
      layer.xPercent !== base.xPercent ||
      layer.yPercent !== base.yPercent ||
      layer.xOrigin !== base.xOrigin ||
      layer.yOrigin !== base.yOrigin
    )
  })
}

/** CSS-переменные для `.portfolio-block-pos` в index.css. */
export function portfolioBlockPositionCssVars(block) {
  const layers = buildPortfolioPositionLayers(block)
  const vars = {}

  const setLayer = (bp, snap) => {
    const suffix = bp === 'default' ? '' : `-${bp}`
    vars[`--pb-x${suffix}`] = snap.left
    vars[`--pb-y${suffix}`] = snap.top
    vars[`--pb-tx${suffix}`] = snap.translateX
    vars[`--pb-ty${suffix}`] = snap.translateY
  }

  for (const bp of PORTFOLIO_POSITION_BREAKPOINTS) {
    if (layers[bp]) setLayer(bp, layers[bp])
  }

  return vars
}

export function getPortfolioBlockPositionPresentation(block) {
  const style = {
    position: 'absolute',
    boxSizing: 'border-box',
  }

  if (block?.zIndex != null && block.zIndex !== '') {
    const z = Number(block.zIndex)
    if (Number.isFinite(z)) style.zIndex = z
  }

  if (!portfolioBlockUsesResponsivePosition(block)) {
    const snap = buildPortfolioPositionLayers(block).default
    return {
      className: undefined,
      posStyle: {
        ...style,
        left: snap.left,
        top: snap.top,
        transform: snap.transform,
      },
    }
  }

  return {
    className: 'portfolio-block-pos',
    posStyle: {
      ...style,
      ...portfolioBlockPositionCssVars(block),
    },
  }
}

/** @deprecated Используйте getPortfolioBlockPositionPresentation */
export function portfolioPositionStyle(block) {
  return getPortfolioBlockPositionPresentation(block).posStyle
}

const DEFAULT_SCROLL_EXTENT_VH = {
  image: 42,
  description: 28,
  text: 12,
}

function resolveBlockYPercent(block) {
  const layers = buildPortfolioPositionLayers(block)
  let maxY = 0
  for (const snap of Object.values(layers)) {
    maxY = Math.max(maxY, snap.yPercent)
  }
  return maxY
}

/**
 * Высота прокручиваемой сцены (vh) по нижней границе всех блоков.
 */
export function computePortfolioStageHeightVh(blocks, options = {}) {
  const minHeightVh = toFiniteNumber(options.minHeightVh, 100)
  const bottomPaddingVh = toFiniteNumber(options.bottomPaddingVh, 16)

  if (typeof options.stageHeightVh === 'number' && Number.isFinite(options.stageHeightVh)) {
    return Math.max(minHeightVh, options.stageHeightVh)
  }

  let maxBottom = minHeightVh
  for (const block of blocks ?? []) {
    const y = resolveBlockYPercent(block)
    const extent =
      block?.scrollExtentVh != null
        ? toFiniteNumber(block.scrollExtentVh, DEFAULT_SCROLL_EXTENT_VH[block?.type] ?? 20)
        : (DEFAULT_SCROLL_EXTENT_VH[block?.type] ?? 20)
    maxBottom = Math.max(maxBottom, y + extent)
  }

  return maxBottom + bottomPaddingVh
}
