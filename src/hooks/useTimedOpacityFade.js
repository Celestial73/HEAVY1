import { useEffect, useMemo, useState } from 'react'

function mergeFadeConfig(defaults, override) {
  if (!override || typeof override !== 'object') return { ...(defaults ?? {}) }
  return { ...(defaults ?? {}), ...override }
}

/**
 * Fade по opacity (как у строк карточек / оверлеев).
 * @returns {{ opacity: number, transition: string, enabled: boolean }}
 */
export function useTimedOpacityFade(config, fadeTransitions = true, sceneReady = true) {
  const {
    enabled = true,
    showAfterSec = 0,
    fadeInSec = 0.5,
    hideAfterSec = null,
    fadeOutSec = 0.5,
  } = config ?? {}

  const [opacity, setOpacity] = useState(() => (fadeTransitions === false ? 1 : 0))
  const [transition, setTransition] = useState('none')

  useEffect(() => {
    if (!enabled) return undefined

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
  }, [enabled, sceneReady, showAfterSec, fadeInSec, hideAfterSec, fadeOutSec, fadeTransitions])

  return useMemo(
    () => ({
      enabled,
      opacity: fadeTransitions === false ? 1 : opacity,
      transition: fadeTransitions === false ? 'none' : transition,
    }),
    [enabled, fadeTransitions, opacity, transition],
  )
}

export { mergeFadeConfig }
