/**
 * Узкие экраны и грубый указатель — типичные телефоны / планшеты.
 * Используется только для снижения нагрузки в WorkflowSection.
 */
export function isWorkflowMobileProfile() {
  if (typeof window === 'undefined') return false
  try {
    const narrow = window.matchMedia('(max-width: 767px)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const shortViewport = window.matchMedia('(max-height: 520px)').matches
    const tabletish = coarse && window.matchMedia('(max-width: 1024px)').matches
    return narrow || shortViewport || tabletish
  } catch {
    return false
  }
}
