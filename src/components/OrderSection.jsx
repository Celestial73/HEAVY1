import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { ORDER_SECTION_SETTINGS as defaults } from '../config/orderSectionSettings.js'
import { submitCallbackRequest } from '../utils/callbackRequest.js'

function resolveOptionHref(option, contact) {
  if (option.type === 'callback') return null
  if (option.href) return option.href

  const key = option.hrefKey
  if (!key || !contact) return null

  const value = contact[key]
  if (!value) return null

  if (option.mailto || key === 'email') {
    const email = value.replace(/^mailto:/i, '')
    return `mailto:${email}`
  }

  return value
}

function resolveCopyValue(option, contact) {
  if (option.copy === false) return null
  if (option.copyValue) return String(option.copyValue).trim()

  const key = option.hrefKey
  if (!key || !contact) return option.copy ? (option.description?.trim() ?? null) : null

  const value = contact[key]
  if (!value) return option.description?.trim() ?? null

  if (option.mailto || key === 'email') {
    return value.replace(/^mailto:/i, '').trim()
  }

  if (key === 'telegram') {
    const handle = value.match(/t\.me\/([^/?#]+)/i)?.[1]
    if (handle) return `@${handle}`
  }

  return option.description?.trim() ?? value.trim()
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('copy failed')
}

function OrderLinkOption({
  option,
  href,
  contact,
  labelClassName,
  descriptionClassName,
  buttonClassName,
  copyButtonLabel,
  copiedButtonLabel,
  delaySec,
}) {
  const [copied, setCopied] = useState(false)
  const external = option.openInNewTab === true || /^https?:\/\//i.test(href)
  const copyValue = resolveCopyValue(option, contact)

  const handleCopy = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!copyValue || copied) return

    try {
      await copyTextToClipboard(copyValue)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`animate-fade-up ${buttonClassName}`}
      style={{ animationDelay: `${delaySec}s` }}
    >
      <div className="flex items-center justify-between gap-3">
        <a
          href={href}
          className="flex min-w-0 flex-1 flex-col gap-1"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span className={labelClassName}>{option.label}</span>
          {option.description ? (
            <span className={descriptionClassName}>{option.description}</span>
          ) : null}
        </a>
        {copyValue ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? copiedButtonLabel : copyButtonLabel}
            title={copied ? copiedButtonLabel : copyButtonLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/35 hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            {copied ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={2} aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function OrderCallbackOption({
  option,
  contact,
  labelClassName,
  descriptionClassName,
  buttonClassName,
  delaySec,
}) {
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorText, setErrorText] = useState('')
  const email = contact?.email?.replace(/^mailto:/i, '') ?? ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email || status === 'loading') return

    setStatus('loading')
    setErrorText('')

    try {
      await submitCallbackRequest(phone, {
        toEmail: email,
        subject: option.emailSubject ?? 'Заказать обратный звонок',
      })
      setStatus('success')
      setPhone('')
    } catch (error) {
      setStatus('error')
      setErrorText(
        error instanceof Error && error.message
          ? error.message
          : (option.errorMessage ?? 'Не удалось отправить. Попробуйте ещё раз.'),
      )
    }
  }

  const isLoading = status === 'loading'
  const isSuccess = status === 'success'

  return (
    <form
      onSubmit={handleSubmit}
      className={`animate-fade-up ${buttonClassName}`}
      style={{ animationDelay: `${delaySec}s` }}
    >
      <span className={labelClassName}>{option.label}</span>
      {option.description ? (
        <span className={descriptionClassName}>{option.description}</span>
      ) : null}
      <label className="mt-3 block font-montserrat text-sm text-white/80">
        <span className="sr-only">Телефон</span>
        <input
          type="tel"
          name="phone"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value)
            if (status === 'success' || status === 'error') setStatus('idle')
          }}
          placeholder={option.phonePlaceholder ?? '+7'}
          className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 font-montserrat text-base text-white outline-none transition placeholder:text-white/35 focus:border-white/40 disabled:opacity-60"
          autoComplete="tel"
          required
          disabled={isLoading}
        />
      </label>
      {errorText ? (
        <p className="mt-2 font-montserrat text-sm text-red-300/90" role="alert">
          {errorText}
        </p>
      ) : null}
      {isSuccess ? (
        <p className="mt-4 font-montserrat text-sm text-emerald-300/90" role="status">
          {option.successMessage ?? 'Окей спасибо'}
        </p>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white font-montserrat text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {isLoading ? (option.loadingLabel ?? 'Отправка…') : (option.submitLabel ?? 'Заказать звонок')}
        </button>
      )}
    </form>
  )
}

export default function OrderSection() {
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/orderSectionSettings.js', (mod) => {
      if (mod?.ORDER_SECTION_SETTINGS) setSettings(mod.ORDER_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  const {
    layout,
    intro,
    hero,
    contact,
    options,
    optionButtonClassName,
    optionLabelClassName,
    optionDescriptionClassName,
    copyButtonLabel = 'Скопировать',
    copiedButtonLabel = 'Скопировано',
  } = settings

  const optionList = Array.isArray(options) ? options : []
  const baseDelay =
    typeof intro?.options?.delay === 'number' && Number.isFinite(intro.options.delay)
      ? intro.options.delay
      : 0.72
  const stagger =
    typeof intro?.options?.staggerSec === 'number' && Number.isFinite(intro.options.staggerSec)
      ? intro.options.staggerSec
      : 0.14
  const heroDelay =
    typeof intro?.hero?.delay === 'number' && Number.isFinite(intro.hero.delay) ? intro.hero.delay : 0.5

  return (
    <section id={layout.sectionId} className={layout.sectionClassName}>
      <div className={layout.containerClassName}>
        <header className="animate-fade-up" style={{ animationDelay: `${heroDelay}s` }}>
          <h1 className={hero.titleClassName}>{hero.title}</h1>
          {hero.subtitle ? <p className={hero.subtitleClassName}>{hero.subtitle}</p> : null}
        </header>

        <div className="flex flex-col gap-4">
          {optionList.map((option, index) => {
            const delaySec = baseDelay + index * stagger

            if (option.type === 'callback') {
              return (
                <OrderCallbackOption
                  key={option.id ?? `callback-${index}`}
                  option={option}
                  contact={contact}
                  labelClassName={optionLabelClassName}
                  descriptionClassName={optionDescriptionClassName}
                  buttonClassName={optionButtonClassName}
                  delaySec={delaySec}
                />
              )
            }

            const href = resolveOptionHref(option, contact)
            if (!href) return null

            return (
              <OrderLinkOption
                key={option.id ?? `link-${index}`}
                option={option}
                href={href}
                contact={contact}
                labelClassName={optionLabelClassName}
                descriptionClassName={optionDescriptionClassName}
                buttonClassName={optionButtonClassName}
                copyButtonLabel={copyButtonLabel}
                copiedButtonLabel={copiedButtonLabel}
                delaySec={delaySec}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
