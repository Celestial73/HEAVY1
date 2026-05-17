import { mergeFadeConfig, useTimedOpacityFade } from '../hooks/useTimedOpacityFade.js'

export function resolveCardOutlineConfig(card, outlineDefaults) {
  return mergeFadeConfig(outlineDefaults, card?.outline)
}

/** Нить между карточкой `ropeIndex` и следующей: `ropeAfter` → `pipelineRopes[i]` (перекрывает). */
export function resolveRopeConfig(cards, ropeIndex, ropeDefaults, ropesByIndex) {
  const fromCard = cards[ropeIndex]?.ropeAfter
  const fromArray =
    Array.isArray(ropesByIndex) && ropesByIndex[ropeIndex] != null
      ? ropesByIndex[ropeIndex]
      : null
  return mergeFadeConfig(mergeFadeConfig(ropeDefaults, fromCard), fromArray)
}

export function PipelineCardOutline({ config, fadeTransitions, sceneReady = true }) {
  const {
    enabled,
    borderColor = 'rgba(255, 255, 255, 0.85)',
    borderWidthPx = 1,
  } = config ?? {}
  const fade = useTimedOpacityFade(config, fadeTransitions, sceneReady)

  if (!enabled) return null

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: fade.opacity,
        transition: fade.transition,
        border: `${borderWidthPx}px solid ${borderColor}`,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
      aria-hidden
    />
  )
}

export function PipelineRopePath({
  d,
  config,
  fadeTransitions,
  sceneReady = true,
  stroke = 'rgba(245, 240, 230, 0.55)',
  strokeWidth = 1.25,
}) {
  const fade = useTimedOpacityFade(config, fadeTransitions, sceneReady)

  if (!config?.enabled) return null

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      style={{
        opacity: fade.opacity,
        transition: fade.transition,
      }}
    />
  )
}
