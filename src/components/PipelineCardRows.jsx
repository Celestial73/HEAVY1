import { useEffect, useMemo, useState } from 'react'

export function mergePipelineCardRow(defaults, row) {
  if (!row || typeof row !== 'object') return { ...defaults }
  return { ...defaults, ...row }
}

/** Отступ сверху перед строкой: `gapBeforePx` на строке или `rowGapPx` карточки между соседними. */
export function resolvePipelineRowGapBeforePx(row, rowIndex, defaultGapPx) {
  const custom = row?.gapBeforePx
  if (custom != null && custom !== '' && Number.isFinite(Number(custom))) {
    return Math.max(0, Number(custom))
  }
  if (rowIndex === 0) return 0
  const fallback =
    typeof defaultGapPx === 'number' && Number.isFinite(defaultGapPx) ? defaultGapPx : 8
  return Math.max(0, fallback)
}

function PipelineCardRow({ row, rowDefaults, fadeTransitions, sceneReady }) {
  const config = useMemo(() => mergePipelineCardRow(rowDefaults ?? {}, row ?? {}), [rowDefaults, row])

  const {
    enabled,
    text,
    fontSizePx,
    fontFamily,
    fontWeight,
    fontStyle,
    color,
    lineHeight,
    lineHeightPx,
    letterSpacing,
    textAlign,
    showAfterSec,
    fadeInSec,
    hideAfterSec,
    fadeOutSec,
  } = config

  const [opacity, setOpacity] = useState(() => (fadeTransitions === false ? 1 : 0))
  const [transition, setTransition] = useState('none')

  useEffect(() => {
    if (!enabled || !text) return undefined

    if (fadeTransitions === false) {
      setTransition('none')
      setOpacity(1)
      return undefined
    }

    if (!sceneReady) {
      setTransition('none')
      setOpacity(0)
      return undefined
    }

    const showMs = Math.max(0, (showAfterSec ?? 0) * 1000)
    const fadeIn = Math.max(0.05, fadeInSec ?? 0.5)
    const fadeOut = Math.max(0.05, fadeOutSec ?? 0.5)
    const shouldHide =
      hideAfterSec != null && typeof hideAfterSec === 'number' && Number.isFinite(hideAfterSec)
    const rawHideMs = shouldHide ? hideAfterSec * 1000 : 0
    const minHideMs = showMs + fadeIn * 1000 + 50
    const hideMs = Math.max(rawHideMs, minHideMs)

    setTransition('none')
    setOpacity(0)

    const tShow = window.setTimeout(() => {
      setTransition(`opacity ${fadeIn}s ease-out`)
      window.requestAnimationFrame(() => {
        setOpacity(1)
      })
    }, showMs)

    const tHide = shouldHide
      ? window.setTimeout(() => {
          setTransition(`opacity ${fadeOut}s ease-in`)
          window.requestAnimationFrame(() => {
            setOpacity(0)
          })
        }, hideMs)
      : null

    return () => {
      window.clearTimeout(tShow)
      if (tHide != null) window.clearTimeout(tHide)
    }
  }, [
    enabled,
    text,
    sceneReady,
    showAfterSec,
    fadeInSec,
    hideAfterSec,
    fadeOutSec,
    fadeTransitions,
  ])

  if (!enabled || !text) return null

  const style = {
    fontFamily,
    fontSize: typeof fontSizePx === 'number' ? `${fontSizePx}px` : fontSizePx,
    fontWeight,
    fontStyle: fontStyle || 'normal',
    color,
    lineHeight: lineHeightPx != null ? `${lineHeightPx}px` : lineHeight,
    letterSpacing,
    textAlign: textAlign || 'center',
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
    opacity: fadeTransitions === false ? 1 : opacity,
    transition: fadeTransitions === false ? 'none' : transition,
  }

  return (
    <span className="block w-full text-balance" style={style}>
      {text}
    </span>
  )
}

/**
 * Вертикальный стек строк внутри карточки Pipeline (центр, сверху вниз).
 */
export default function PipelineCardRows({
  rows,
  rowDefaults,
  fadeTransitions = true,
  sceneReady = true,
  gapPx = 6,
}) {
  const list = Array.isArray(rows) ? rows.filter((r) => r && r.enabled !== false && r.text) : []
  if (list.length === 0) return null

  const defaultGap =
    typeof gapPx === 'number' && Number.isFinite(gapPx) ? gapPx : 8

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col items-center justify-center px-3 py-3">
      {list.map((row, index) => (
        <div
          key={row.id != null ? String(row.id) : index}
          className="w-full"
          style={{
            marginTop: resolvePipelineRowGapBeforePx(row, index, defaultGap),
          }}
        >
          <PipelineCardRow
            row={row}
            rowDefaults={rowDefaults}
            fadeTransitions={fadeTransitions}
            sceneReady={sceneReady}
          />
        </div>
      ))}
    </div>
  )
}
