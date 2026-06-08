import { toCssLength } from './cssLength.js'

const WIDTH_VW_FALLBACK = 40

/** Tailwind-пороги (mobile-first). */
export const PORTFOLIO_WIDTH_BREAKPOINTS = [
  ['sm', 640],
  ['md', 768],
  ['lg', 1024],
  ['xl', 1280],
  ['2xl', 1536],
]

function resolveBaseVwFromSpec(spec, fallback = WIDTH_VW_FALLBACK) {
  if (typeof spec === 'number' && Number.isFinite(spec)) return spec
  if (!spec || typeof spec !== 'object') return fallback
  const base = spec.default ?? spec.base
  return typeof base === 'number' && Number.isFinite(base) ? base : fallback
}

export function resolvePortfolioBlockMaxWidth(block) {
  const maxWidthCss = toCssLength(block?.maxWidth)
  if (maxWidthCss) return maxWidthCss

  if (typeof block?.maxWidthPx === 'number' && Number.isFinite(block.maxWidthPx) && block.maxWidthPx > 0) {
    return `${block.maxWidthPx}px`
  }

  if (typeof block?.maxWidthVw === 'number' && Number.isFinite(block.maxWidthVw)) {
    return `${block.maxWidthVw}vw`
  }

  return undefined
}

function resolveWidthSpec(block, fallbackWidthVw) {
  if (block?.widthVw != null) return block.widthVw
  if (toCssLength(block?.width) || block?.widthPx) return null
  return fallbackWidthVw
}

function resolveFixedWidth(block, fallbackWidthVw) {
  const widthCss = toCssLength(block?.width)
  if (widthCss) return widthCss

  if (typeof block?.widthPx === 'number' && Number.isFinite(block.widthPx) && block.widthPx > 0) {
    return `${block.widthPx}px`
  }

  if (typeof block?.widthVw === 'number' && Number.isFinite(block.widthVw)) {
    return `${block.widthVw}vw`
  }

  if (block?.widthVw == null && typeof fallbackWidthVw === 'number' && Number.isFinite(fallbackWidthVw)) {
    return `${fallbackWidthVw}vw`
  }

  return null
}

/** CSS-переменные `--pbw`, `--pbw-md`, … для класса `.portfolio-block-w` в index.css. */
export function portfolioBlockWidthCssVars(block, fallbackWidthVw) {
  const spec = resolveWidthSpec(block, fallbackWidthVw)
  if (spec == null) return null

  if (typeof spec === 'number' && Number.isFinite(spec)) {
    return { '--pbw': `${spec}vw` }
  }

  if (typeof spec === 'object') {
    const vars = {
      '--pbw': `${resolveBaseVwFromSpec(spec, resolveBaseVwFromSpec(fallbackWidthVw))}vw`,
    }
    for (const [key] of PORTFOLIO_WIDTH_BREAKPOINTS) {
      if (typeof spec[key] === 'number' && Number.isFinite(spec[key])) {
        vars[`--pbw-${key}`] = `${spec[key]}vw`
      }
    }
    return vars
  }

  return null
}

export function getPortfolioBlockPresentation(block, fallbackWidthVw, stageInsetPx = 24) {
  const inset =
    typeof stageInsetPx === 'number' && Number.isFinite(stageInsetPx) ? stageInsetPx : 24
  const viewportCap = `calc(100vw - ${inset * 2}px)`
  const maxWidth = resolvePortfolioBlockMaxWidth(block)
  const allowWiderThanViewport = block?.allowWiderThanViewport === true

  const sizeStyle = {
    boxSizing: 'border-box',
  }

  if (allowWiderThanViewport) {
    if (maxWidth) sizeStyle.maxWidth = maxWidth
  } else if (maxWidth) {
    sizeStyle.maxWidth = `min(${maxWidth}, ${viewportCap})`
  } else {
    sizeStyle.maxWidth = viewportCap
  }

  const widthVars = portfolioBlockWidthCssVars(block, fallbackWidthVw)
  if (widthVars) {
    Object.assign(sizeStyle, widthVars)
    return { className: 'portfolio-block-w', sizeStyle }
  }

  const fixedWidth = resolveFixedWidth(block, fallbackWidthVw)
  if (fixedWidth) {
    sizeStyle.width = fixedWidth
  }

  return { className: undefined, sizeStyle }
}
