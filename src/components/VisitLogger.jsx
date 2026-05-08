import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { logPageView } from '../utils/visitLog.js'

/**
 * Отправляет событие при каждом изменении маршрута (включая первый заход).
 * Короткое дедуплицирование — чтобы в React Strict Mode (dev) не было двойной отправки.
 */
export default function VisitLogger() {
  const location = useLocation()
  const lastRef = useRef({ key: '', at: 0 })

  useEffect(() => {
    const key = `${location.pathname}\0${location.search}`
    const now = Date.now()
    const prev = lastRef.current
    if (prev.key === key && now - prev.at < 120) return
    lastRef.current = { key, at: now }

    logPageView(location.pathname, location.search)
  }, [location.pathname, location.search])

  return null
}
