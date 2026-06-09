/**
 * Яндекс.Метрика. Счётчик: https://metrika.yandex.ru
 *
 * Переопределение ID при сборке: VITE_YM_COUNTER_ID=109743701
 */
export const YANDEX_METRIKA_SETTINGS = {
  counterId: 109743701,

  /** SPA: defer + ручные hit при смене маршрута (см. YandexMetrika.jsx). */
  init: {
    defer: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    /** Вариант A — без вебвизора (можно включить позже в настройках и здесь). */
    webvisor: false,
  },
}
