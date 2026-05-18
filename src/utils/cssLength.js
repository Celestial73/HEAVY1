/**
 * Число → `12px` / `10vh`; строка — как есть (`clamp(...)`, `calc(...)`, `85vw`).
 */
export function toCssLength(value, defaultUnit = 'px') {
  if (value == null || value === '') return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}${defaultUnit}`
  return undefined
}
