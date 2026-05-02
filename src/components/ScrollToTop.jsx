import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * При каждом переходе по роуту прокручивает страницу в самый верх.
 * Без этого SPA-навигация сохраняет старый scroll position.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
