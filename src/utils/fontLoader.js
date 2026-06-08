/**
 * Предзагрузка @font-face до первого рендера текста (убирает FOUT на /comparison и др.).
 */

const CYRILLIC_SAMPLE = 'Агентство утяжеления ABCDEFG 0123456789'

/** Tailwind `font-*` → имя из @font-face в index.css */
const TAILWIND_FONT_FAMILY = {
  'font-brand': 'Bebas Neue',
  'font-kalissa': 'Kalissa',
  'font-kalissa-swashes': 'Kalissa Swashes',
  'font-museo-cyrl': 'Museo Cyrl',
  'font-st-rome': 'ST Rome',
  'font-cc-ultimatum': 'CC Ultimatum',
  'font-futura-bk-bt': 'Futura BK BT',
  'font-coolvetica': 'Coolvetica',
  'font-coolvetica-condensed': 'Coolvetica Condensed',
  'font-coolvetica-compressed': 'Coolvetica Compressed',
  'font-lora': 'Lora',
  'font-montserrat': 'Montserrat',
}

const TEXT_SIZE_PX = {
  'text-8xl': 96,
  'text-7xl': 72,
  'text-6xl': 60,
  'text-5xl': 48,
  'text-4xl': 36,
  'text-3xl': 30,
  'text-2xl': 24,
  'text-xl': 20,
  'text-lg': 18,
  'text-base': 16,
}

/** Файлы из public/fonts — rel="preload" в <head>. */
const CRITICAL_FONT_FILES = [
  'fonts/BebasNeue-Regular.ttf',
  'fonts/KalissaRegular_0.otf',
  'fonts/STRomeTrial-Regular.ttf',
  'fonts/MUSEO_CYRL_500_REGULAR-WEBFONT%20%281%29.TTF',
  'fonts/EXLJBRIS_-_MUSEO_CYRL_300-WEBFONT%20%281%29.TTF',
]

let preloadLinksInjected = false
let appFontsPromise = null

export function extractQuotedFontFamilies(cssStack) {
  if (!cssStack || typeof cssStack !== 'string') return []
  const out = []
  const re = /'([^']+)'|"([^"]+)"/g
  let m
  while ((m = re.exec(cssStack)) !== null) {
    const name = (m[1] || m[2]).trim()
    if (name && !/^(Inter|system-ui|sans-serif|serif|monospace)$/i.test(name)) {
      out.push(name)
    }
  }
  return [...new Set(out)]
}

function resolvePublicAssetUrl(path) {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${normalizedBase}${normalizedPath}`
}

function injectFontPreloadLinks() {
  if (preloadLinksInjected || typeof document === 'undefined') return
  preloadLinksInjected = true
  for (const file of CRITICAL_FONT_FILES) {
    const href = resolvePublicAssetUrl(file)
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
}

function familyFromClassName(className = '') {
  const tokens = className.split(/\s+/)
  for (const token of tokens) {
    if (TAILWIND_FONT_FAMILY[token]) return TAILWIND_FONT_FAMILY[token]
  }
  return null
}

function weightFromClassName(className = '') {
  if (/\bfont-black\b/.test(className)) return '900'
  if (/\bfont-bold\b/.test(className)) return '700'
  if (/\bfont-semibold\b/.test(className)) return '600'
  if (/\bfont-medium\b/.test(className)) return '500'
  if (/\bfont-light\b/.test(className)) return '300'
  if (/\bfont-thin\b/.test(className)) return '100'
  return '400'
}

function sizePxFromClassName(className = '') {
  let max = 20
  for (const [token, px] of Object.entries(TEXT_SIZE_PX)) {
    if (className.includes(token)) max = Math.max(max, px)
  }
  return max
}

function specKey(spec) {
  return `${spec.family}|${spec.weight}|${spec.sizePx}`
}

/**
 * @param {{ family: string, weight?: string, sizePx?: number }[]} specs
 */
export async function loadFontSpecs(specs) {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  injectFontPreloadLinks()
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }

  const seen = new Set()
  const loads = []
  for (const raw of specs) {
    const family = raw.family
    if (!family) continue
    const weight = String(raw.weight ?? '400').trim() || '400'
    const sizePx = raw.sizePx ?? 24
    const key = specKey({ family, weight, sizePx })
    if (seen.has(key)) continue
    seen.add(key)
    loads.push(
      document.fonts.load(`${weight} ${sizePx}px '${family}'`, CYRILLIC_SAMPLE).catch(() => {}),
    )
  }
  await Promise.all(loads)
}

/** Шрифты секции Comparison из className в настройках. */
export function buildComparisonFontSpecs(settings) {
  const text = settings?.text ?? {}
  const specs = []

  const addFromClassName = (className) => {
    const family = familyFromClassName(className)
    if (!family) return
    specs.push({
      family,
      weight: weightFromClassName(className),
      sizePx: sizePxFromClassName(className),
    })
  }

  if (text.titleClassName) addFromClassName(text.titleClassName)
  for (const p of text.paragraphs ?? []) {
    const combined = [text.paragraphBaseClassName, p.className].filter(Boolean).join(' ')
    addFromClassName(combined)
  }

  return specs
}

export async function preloadComparisonFonts(settings) {
  return loadFontSpecs(buildComparisonFontSpecs(settings))
}

/** Шрифты секции Portfolio из className в настройках. */
export function buildPortfolioFontSpecs(settings) {
  const specs = []
  const addFromClassName = (className) => {
    const family = familyFromClassName(className)
    if (!family) return
    specs.push({
      family,
      weight: weightFromClassName(className),
      sizePx: sizePxFromClassName(className),
    })
  }

  const { descriptionDefaults, textDefaults, hero } = settings ?? {}
  if (hero?.titleClassName) addFromClassName(hero.titleClassName)
  if (descriptionDefaults?.titleClassName) addFromClassName(descriptionDefaults.titleClassName)
  if (descriptionDefaults?.descriptionClassName) {
    addFromClassName(descriptionDefaults.descriptionClassName)
  }
  if (textDefaults?.className) addFromClassName(textDefaults.className)

  for (const block of settings?.blocks ?? []) {
    if (block.titleClassName) addFromClassName(block.titleClassName)
    if (block.descriptionClassName) addFromClassName(block.descriptionClassName)
    if (block.className) addFromClassName(block.className)
  }

  return specs
}

export async function preloadPortfolioFonts(settings) {
  return loadFontSpecs(buildPortfolioFontSpecs(settings))
}

/** Все кастомные семейства сайта — вызывать один раз при старте SPA. */
export function buildAppFontSpecs() {
  const specs = []
  const add = (family, weight = '400', sizePx = 48) => {
    specs.push({ family, weight, sizePx })
  }

  for (const family of Object.values(TAILWIND_FONT_FAMILY)) {
    add(family, '400', 48)
  }
  add('Bebas Neue', '400', 96)
  add('Kalissa', '400', 72)
  add('Museo Cyrl', '300', 24)
  add('Museo Cyrl', '500', 24)
  add('ST Rome', '400', 30)
  add('Lora', '400', 20)
  add('Montserrat', '500', 20)

  return specs
}

export function preloadAppFonts() {
  if (!appFontsPromise) {
    appFontsPromise = loadFontSpecs(buildAppFontSpecs())
  }
  return appFontsPromise
}
