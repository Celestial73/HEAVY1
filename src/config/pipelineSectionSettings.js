/**
 * Базовый шаблон одного текстового оверлея Pipeline: каждый элемент `textOverlays[]`
 * поверх него shallow-merge (можно задать только `text` и тайминги).
 * Компонент: `SectionTextOverlay` — без зависимости от Process.
 */
export const PIPELINE_TEXT_OVERLAY_ITEM_DEFAULTS = {
  enabled: true,
  text: '',
  /** Число — размер в px; строка — любое валидное CSS для `font-size` (например `clamp(16px, 4vw, 24px)` как на карточках). */
  fontSizePx: 17,
  fontFamily: "'Inter', system-ui, sans-serif",
  fontWeight: '500',
  color: 'rgba(236, 242, 250, 0.94)',
  lineHeight: 1.4,
  letterSpacing: '0.01em',
  yPercent: null,
  xPercent: null,
  xSide: null,
  yOrigin: null,
  xOrigin: null,
  placement: 'corner',
  corner: 'bottom-left',
  insetPx: 28,
  maxWidthPx: 340,
  textAlign: 'left',
  showAfterSec: 1.2,
  fadeInSec: 0.65,
  /** `null` или не число — не гасить; число — сек от старта таймлайна до fade-out */
  hideAfterSec: null,
  fadeOutSec: 0.75,
}

/**
 * Одна строка внутри карточки Pipeline (`pipelineCards[].rows[]`).
 * Shallow-merge с `pipelineCardRowDefaults` в `PipelineCardRows.jsx`.
 */
export const PIPELINE_CARD_ROW_DEFAULTS = {
  enabled: true,
  text: '',
  /** Число — px; строка — CSS (`clamp(...)` и т.д.). */
  fontSizePx: 'clamp(15px, 4.2vw, 22px)',
  fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
  fontWeight: '400',
  fontStyle: 'normal',
  color: '#ffffff',
  lineHeight: 1.12,
  letterSpacing: '0.02em',
  textAlign: 'center',
  /** Сек от монтирования карточки до начала fade-in. */
  showAfterSec: 0,
  fadeInSec: 0.55,
  /** `null` — строка не гаснет; число — сек до начала fade-out. */
  hideAfterSec: null,
  fadeOutSec: 0.55,
  /**
   * Отступ сверху перед этой строкой (px). У первой строки — от верха блока текста.
   * Не задано — для 2-й и далее используется `rowGapPx` карточки / `pipelineCardRowGapPx`.
   */
  gapBeforePx: null,
}

/** Рамка (outline) карточки Pipeline — fade и цвет границы. */
export const PIPELINE_CARD_OUTLINE_DEFAULTS = {
  enabled: true,
  showAfterSec: 0.15,
  fadeInSec: 0.55,
  hideAfterSec: null,
  fadeOutSec: 0.45,
  borderColor: 'rgba(255, 255, 255, 0.85)',
  borderWidthPx: 1,
}

/** Нить между соседними карточками — fade и stroke. */
export const PIPELINE_ROPE_DEFAULTS = {
  enabled: true,
  showAfterSec: 0.35,
  fadeInSec: 0.75,
  hideAfterSec: null,
  fadeOutSec: 0.5,
  stroke: 'rgba(245, 240, 230, 0.55)',
  strokeWidth: 1.25,
  sagFactor: 0.14,
  maxSagPx: 36,
}

/**
 * Секция «Pipeline»: только этот файл + `SectionTextOverlay` + `PipelineSection.jsx`.
 *
 * Поля одного элемента `textOverlays[]` — см. `PIPELINE_TEXT_OVERLAY_ITEM_DEFAULTS` и комментарии ниже.
 *
 * - `id` — стабильный ключ React.
 * - `enabled`, `text`, переносы в тексте — `\n`.
 * - Позиция: `yPercent`, `xPercent`, `xOrigin`, `yOrigin`, либо `xSide`, `placement`, `corner`.
 * - `insetPx`, `maxWidthPx`, `textAlign`; шрифт: `fontSizePx`, `fontFamily`, `fontWeight`, `color`, …
 *   (`fontSizePx` — число в px **или** строка `clamp(min, предпочтительно vw, max)` для fluid-типа как у `pipelineCards[].textClassName`.)
 *   (`fontFamily` — строка для CSS `font-family`: имена как в `@font-face` в `index.css`, например `'Coolvetica'`, `'Museo Cyrl'`, `'CC Ultimatum'`;
 *   из Google Fonts в том же файле: `'Lora'`, `'Montserrat'`; классы вида `font-coolvetica` — только в Tailwind-строках `className` / `textClassName`.)
 * - `showAfterSec`, `fadeInSec`; `hideAfterSec`, `fadeOutSec` для автоскрытия.
 *
 * Глобально: `fadeTransitions` (оверлеи), `pipelineCardFadeTransitions` (строки),
 * `pipelineChromeFadeTransitions` (рамки и нити), `pipelineCardOutlineDefaults`, `pipelineRopeDefaults`,
 * `pipelineRopes[]`, `layoutColumnMaxWidth`, …
 */
export const PIPELINE_SECTION_SETTINGS = {
  fadeTransitions: false,
  /** Fade-in/out у строк внутри карточек (независимо от `fadeTransitions` оверлеев). */
  pipelineCardFadeTransitions: true,
  /** Fade-in/out рамок карточек и нитей между ними. */
  pipelineChromeFadeTransitions: true,
  layoutColumnMaxWidth: null,

  /** Вертикальная зона для карточек: отступ сверху/снизу от края вьюпорта (px). */
  pipelineCardsStageInsetPx: 24,
  /** Зарезервировать место под нижнюю навигацию (px), чтобы карточки не заезжали под кнопку. */
  pipelineCardsBottomReservePx: 108,
  /**
   * Дефолтный коэффициент высота/ширина: высота в px ≈ ширина в px × ratio (ширина после fluid).
   * У отдельной карточки можно задать свой `heightWidthRatio` — перекроет это значение.
   */
  pipelineCardHeightWidthRatio: 0.5,
  /** Дефолты для каждого элемента `pipelineCards[].rows[]`. */
  pipelineCardRowDefaults: {
    ...PIPELINE_CARD_ROW_DEFAULTS,
    showAfterSec: 0.15,
    fadeInSec: 0.6,
  },
  /** Вертикальный зазор между строками внутри карточки (px); у карточки — `rowGapPx`. */
  pipelineCardRowGapPx: 8,
  /** Дефолты появления рамки карточки; у карточки — `outline: { … }`. */
  pipelineCardOutlineDefaults: {
    ...PIPELINE_CARD_OUTLINE_DEFAULTS,
  },
  /** Дефолты нитей; у карточки — `ropeAfter` (нить к следующей) или `pipelineRopes[i]`. */
  pipelineRopeDefaults: {
    ...PIPELINE_ROPE_DEFAULTS,
  },
  /**
   * Опционально: тайминги по каждой нити (0 = между 1-й и 2-й карточкой). Перекрывает `ropeAfter`.
   * Длина обычно `pipelineCards.length - 1`.
   */
  pipelineRopes: null,

  /**
   * Перетаскиваемые прямоугольники (чёрный фон, тонкая белая граница).
   * Текст — массив **`rows`**: каждый элемент = отдельная строка, по центру, столбиком сверху вниз.
   *
   * Позиция:
   * - Если у **каждой** карточки заданы `initialXPercent` и `initialYPercent` (0–100) —
   *   центр карточки в процентах ширины/высоты **вьюпорта**; длины верёвок считаются по этим местам.
   * - Иначе — вертикальная колонка по центру с равными промежутками.
   *
   * Карточка: `id`, `widthPx`, `heightWidthRatio`, `rows[]`, `initialXPercent`, `initialYPercent`,
   * `rowGapPx`, `outline` (рамка), `ropeAfter` (нить к следующей карточке), `enabled`.
   *
   * Строка (`rows[]`): см. `PIPELINE_CARD_ROW_DEFAULTS` — `text`, `fontSizePx`, `fontFamily`,
   * `gapBeforePx` (свой отступ сверху, px), …
   * `fontWeight`, `fontStyle`, `color`, `showAfterSec`, `fadeInSec`, `hideAfterSec`, `fadeOutSec`, …
   */
  pipelineCards: [
    {
      id: 'pipeline-card-1',
      widthPx: 'clamp(230px, 44vw, 250px)',
      heightWidthRatio: 0.9,
      rowGapPx: 0,
      outline: { showAfterSec: 3, fadeInSec: 2 },
      ropeAfter: { showAfterSec: 6.2, fadeInSec: 2 },
      initialXPercent: 60,
      initialYPercent: 15,
      rows: [
        {
          id: 'think',
          text: 'Мы долго',
          fontFamily: "'Lora', 'Inter', system-ui, sans-serif",
          fontSizePx: 'clamp(15px, 4.2vw, 20px)',
          color: 'rgba(200, 206, 214, 0.88)',
          showAfterSec: 1,
          fadeInSec: 0.8,
        },
        {
          id: 'think1',
          text: 'Думаем',
          fontSizePx: 'clamp(50px, 5vw, 60px)',
          showAfterSec: 1.5,
          fadeInSec: 0.8,
        },
        {
          id: 'think-italic3',
          fontFamily: "'Lora', system-ui, sans-serif",
          text: 'Как утяжелить',
          fontSizePx: 'clamp(17px, 4.5vw, 19px)',
          color: 'rgba(200, 206, 214, 0.88)',
          gapBeforePx: 4,
          showAfterSec: 2.5,
          fadeInSec: 0.8,
        },
        {
          id: 'think-italic2',
          fontFamily: "'Kalissa', system-ui, sans-serif",
          text: 'Вещь',
          fontSizePx: 'clamp(20px, 8vw, 60px)',
          gapBeforePx: 4,
          showAfterSec: 3,
          fadeInSec: 1,
        },
      ],
    },
    {

      id: 'pipeline-card-3',
      widthPx: 'clamp(250px, 52vw, 300px)',
      heightWidthRatio:0.6,
      rowGapPx: 0,
      outline: { showAfterSec: 6.2, fadeInSec: 2 },
      ropeAfter: { showAfterSec: 9, fadeInSec: 2 },
      initialXPercent: 36,
      initialYPercent: 45,
      rows: [
        {
          id: 'collect',
          fontFamily: "'Lora', 'Inter', system-ui, sans-serif",
          text: 'Cобираем и',
          color: 'rgba(200, 206, 214, 0.88)',
          fontSizePx: 'clamp(18px, 5vw, 20px)',
          showAfterSec: 4.8,
          fadeInSec:  0.8,
        },
        {
          id: 'melt',
          text: 'Плавим',
          fontSizePx: 'clamp(50px, 5vw, 70px)',
          showAfterSec: 5.5,
          fadeInSec:  0.8,
        },
        {
          id: 'metal',
          fontFamily: "'Kalissa', system-ui, sans-serif",
          text: 'Металл',
          color: 'rgba(200, 206, 214, 0.88)',
          fontSizePx: 'clamp(29px, 5vw, 35px)',
          showAfterSec: 6.2,
          fadeInSec:  0.8,
        },
      ],
    },
    {
      id: 'pipeline-card-4',
      widthPx: 'clamp(300px, 48vw, 270px)',
      heightWidthRatio: 0.6,
      rowGapPx: 1,
      outline: { showAfterSec: 9, fadeInSec: 2 },
      initialXPercent: 60,
      initialYPercent: 74,
      rows: [
        {
          id: 'via_metall',
          text: 'Металлом',
          fontFamily: "'Lora', 'Inter', system-ui, sans-serif",
          color: 'rgba(200, 206, 214, 0.88)',
          fontSizePx: 'clamp(18px, 5vw, 20px)',
          showAfterSec: 7,
          fadeInSec: 0.8,
        },
        {
          id: 'weight',
          text: 'Утяжеляем',
          fontSizePx: 'clamp(45px, 5vw, 55px)',
          showAfterSec: 8,
          fadeInSec: 0.8,
        },
        {
          id: 'thing',
          text: 'Штуку',
          fontFamily: "'Kalissa', system-ui, sans-serif",
          color: 'rgba(200, 206, 214, 0.88)',
          fontSizePx: 'clamp(30px, 5vw, 40px)',
          showAfterSec: 9,
          fadeInSec: 0.8,
        },
      ],
    },
  ],

  textOverlayItemDefaults: {
    ...PIPELINE_TEXT_OVERLAY_ITEM_DEFAULTS,
    showAfterSec: 0.35,
    fadeInSec: 0.55,
  },

  textOverlays: [

    {
      fontSizePx: 'clamp(22px, 4.5vw, 44px)',
      yPercent: 60,
      xPercent: 63,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
    {
      fontSizePx: 'clamp(28px, 6vw, 64px)',
      yPercent: 80,
      xPercent: 52,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
  ],
}
