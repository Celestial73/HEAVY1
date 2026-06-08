/**
 * Заявка на обратный звонок.
 *
 * POST JSON на `/api/callback` (nginx → Python на VDS, письмо через SMTP mail.ru).
 * Переопределение: `VITE_CALLBACK_URL`.
 */

const CALLBACK_ENDPOINT = import.meta.env.VITE_CALLBACK_URL ?? '/api/callback'

/**
 * @param {string} phone
 * @param {{ toEmail: string, subject?: string }} options
 */
export async function submitCallbackRequest(phone, options = {}) {
  const trimmed = String(phone ?? '').trim()
  if (!trimmed) {
    throw new Error('Укажите номер телефона')
  }

  const subject = options.subject ?? 'Заказать обратный звонок'
  const at = new Date().toISOString()

  const response = await fetch(CALLBACK_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phone: trimmed, subject, at }),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    /* ignore */
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? data?.message ?? 'Не удалось отправить заявку')
  }

  return { ok: true }
}
