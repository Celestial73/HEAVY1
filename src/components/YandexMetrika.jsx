import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { YANDEX_METRIKA_SETTINGS as defaults } from '../config/yandexMetrikaSettings.js'
import {
  getYandexMetrikaCounterId,
  hitYandexMetrikaPage,
  initYandexMetrika,
} from '../utils/yandexMetrika.js'

/**
 * Яндекс.Метрика для SPA: init с defer + ym('hit') при смене маршрута.
 */
export default function YandexMetrika() {
  const location = useLocation()
  const counterId = getYandexMetrikaCounterId()
  const readyRef = useRef(false)
  const lastRef = useRef({ key: '', at: 0 })

  useEffect(() => {
    if (!counterId) return undefined

    let cancelled = false

    initYandexMetrika(counterId, defaults.init).then(() => {
      if (cancelled) return
      readyRef.current = true
      hitYandexMetrikaPage(counterId, location.pathname, location.search)
      lastRef.current = {
        key: `${location.pathname}\0${location.search}`,
        at: Date.now(),
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per mount
  }, [counterId])

  useEffect(() => {
    if (!counterId || !readyRef.current) return

    const key = `${location.pathname}\0${location.search}`
    const now = Date.now()
    const prev = lastRef.current
    if (prev.key === key && now - prev.at < 120) return
    lastRef.current = { key, at: now }

    hitYandexMetrikaPage(counterId, location.pathname, location.search)
  }, [counterId, location.pathname, location.search])

  if (!counterId) return null

  return (
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${counterId}`}
          style={{ position: 'absolute', left: '-9999px' }}
          alt=""
        />
      </div>
    </noscript>
  )
}
