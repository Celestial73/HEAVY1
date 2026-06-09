import { YANDEX_METRIKA_SETTINGS as defaults } from '../config/yandexMetrikaSettings.js'

const TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js'

let scriptPromise = null
let initialized = false

/**
 * @returns {number | null}
 */
export function getYandexMetrikaCounterId() {
  const fromEnv = import.meta.env.VITE_YM_COUNTER_ID
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    const parsed = Number(fromEnv)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromConfig = defaults.counterId
  if (typeof fromConfig === 'number' && Number.isFinite(fromConfig) && fromConfig > 0) {
    return fromConfig
  }

  return null
}

function ensureYmStub() {
  if (typeof window === 'undefined') return
  window.ym =
    window.ym ||
    function ymStub(...args) {
      window.ym.a = window.ym.a || []
      window.ym.a.push(args)
    }
  window.ym.l = window.ym.l || Date.now()
}

function loadMetrikaScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.__ymScriptLoaded) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  ensureYmStub()

  scriptPromise = new Promise((resolve) => {
    for (const existing of document.scripts) {
      if (existing.src && existing.src.includes('mc.yandex.ru/metrika/tag.js')) {
        window.__ymScriptLoaded = true
        resolve()
        return
      }
    }

    const script = document.createElement('script')
    script.async = true
    script.src = TAG_SRC
    script.onload = () => {
      window.__ymScriptLoaded = true
      resolve()
    }
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * @param {number} counterId
 * @param {Record<string, unknown>} [options]
 */
export async function initYandexMetrika(counterId, options = defaults.init) {
  if (!counterId || initialized) return
  await loadMetrikaScript()
  if (!window.ym) return

  window.ym(counterId, 'init', options)
  initialized = true
}

/**
 * @param {number} counterId
 * @param {string} pathname
 * @param {string} [search]
 */
export function hitYandexMetrikaPage(counterId, pathname, search = '') {
  if (!counterId || !window.ym) return

  const url = `${pathname || '/'}${search || ''}`
  window.ym(counterId, 'hit', url, {
    title: document.title,
  })
}

/**
 * @param {number} counterId
 * @param {string} target
 * @param {Record<string, unknown>} [params]
 */
export function reachYandexMetrikaGoal(counterId, target, params) {
  if (!counterId || !window.ym || !target) return
  window.ym(counterId, 'reachGoal', target, params)
}
