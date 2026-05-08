/**
 * Логирование просмотров (лендинг + переходы по маршрутам SPA).
 *
 * Задайте в `.env` или в настройках хостинга:
 *   VITE_VISIT_LOG_URL=https://ваш-сервер.example/log
 *
 * Сервер должен принимать POST с JSON-телом. Поля см. в `buildVisitPayload`.
 * Без переменной — функции no-op (ничего не уходит в сеть).
 */

const ENDPOINT = import.meta.env.VITE_VISIT_LOG_URL

export function buildVisitPayload(pathname, search = '') {
  if (typeof window === 'undefined') return null
  return {
    at: new Date().toISOString(),
    path: `${pathname || '/'}${search || ''}`,
    href: window.location.href,
    referrer: document.referrer || '',
    /** Учитывайте политику конфиденциальности; при необходимости уберите или сократите. */
    language: navigator.language || '',
  }
}

/**
 * @param {string} pathname
 * @param {string} [search]
 */
export function logPageView(pathname, search = '') {
  if (!ENDPOINT || typeof ENDPOINT !== 'string') return

  const payload = buildVisitPayload(pathname, search)
  if (!payload) return

  const body = JSON.stringify(payload)

  void fetch(ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* тихий сбой — логирование не должно ломать сайт */
  })
}
