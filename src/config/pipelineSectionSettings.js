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
 * Глобально: `fadeTransitions`, `layoutColumnMaxWidth` (px или `null`),
 * `pipelineCardHeightWidthRatio` — высота карточки = ширина × коэффициент (см. `pipelineCards`).
 */
export const PIPELINE_SECTION_SETTINGS = {
  fadeTransitions: false,
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

  /**
   * Четыре перетаскиваемых прямоугольника (чёрный фон, тонкая белая граница).
   * Внутри: один крупный текст по центру, под ним — маленькая картинка (`imageUrl`).
   *
   * Позиция:
   * - Если у **каждой** карточки заданы `initialXPercent` и `initialYPercent` (0–100) —
   *   центр карточки в процентах ширины/высоты **вьюпорта**; длины верёвок считаются по этим местам.
   * - Иначе — прежняя вертикальная колонка по центру с равными промежутками.
   *
   * Поля: `id`, `text`, `widthPx` (число в px **или** строка `clamp(...)` / `…vw` / `…vh` / `…px`),
   * высота = ширина × **`heightWidthRatio`** на карточке, если задано число > 0, иначе × **`pipelineCardHeightWidthRatio`**,
   * `imageUrl` (путь от `public/`), опционально `textClassName`, `imageClassName`, `enabled`.
   *
   * Размер текста — внутри `textClassName`, например:
   * - фиксированный: `text-lg`, `text-xl`, `text-2xl` или `text-[20px]`;
   * - от вьюпорта: `text-[clamp(14px,3.5vw,22px)]` (мин, предпочтительно от vw, макс);
   * без `textClassName` — дефолт в `PipelineDraggableCards.jsx` (`clamp(15px,4.2vw,22px)`).
   * Шрифты: `font-museo-cyrl`, `font-kalissa`, `font-brand`, …; из `public/fonts/` также `font-cc-ultimatum` (лучше с `font-bold` / `font-black`), `font-futura-bk-bt` и `italic` для курсива, `font-coolvetica` / `font-coolvetica-condensed` / `font-coolvetica-compressed`; из Google Fonts — `font-lora`, `font-montserrat`.
   */
  pipelineCards: [
    {
      id: 'pipeline-card-1',
      text: 'Думаем',
      widthPx: 'clamp(250px, 44vw, 400px)',
      imageUrl: 'images/furnace.jpg',
      initialXPercent: 60,
      initialYPercent: 15,
      textClassName:
        'text-center font-brand text-[clamp(45px,5vw,40px)] font-italic tracking-[0.02em] text-white',
    },
    {
      id: 'pipeline-card-3',
      text: 'Плавим',
      widthPx: 'clamp(200px, 52vw, 300px)',
      imageUrl: 'images/yolandi.png',
      initialXPercent: 24,
      initialYPercent: 45,
      textClassName:
        'text-center font-brand text-[clamp(45px,5vw,45px)] font-normal tracking-[0.02em] text-white',
    },
    {
      id: 'pipeline-card-4',
      text: 'Утяжеляем',
      widthPx: 'clamp(180px, 48vw, 270px)',
      imageUrl: 'images/furnace_beautiful.png',
      initialXPercent: 60,
      initialYPercent: 74,
      textClassName:
        'text-center font-brand text-[clamp(45px,5vw,50px)] font-normal tracking-[0.02em] text-white',
    },
  ],

  textOverlayItemDefaults: {
    ...PIPELINE_TEXT_OVERLAY_ITEM_DEFAULTS,
    showAfterSec: 0.35,
    fadeInSec: 0.55,
  },

  textOverlays: [
    {
      id: 'pipeline-intro',
      fontFamily: "'Lora', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 'clamp(26px, 4.2vw, 48px)',
      text: 'Мы долго',
      yPercent: 5,
      xPercent: 22,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 520,
      showAfterSec: 0.2,
      fadeInSec: 0.6,
    },
    {
      id: 'pipeline-hint',
      fontFamily: "'Lora', system-ui, sans-serif",
      fontWeight: '800',
      fontSizePx: 'clamp(17px, 4.5vw, 28px)',
      color: 'rgba(200, 206, 214, 0.88)',
      text: 'как утяжелить',
      yPercent: 19,
      xPercent: 83,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'right',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
    {
      id: 'pipeline-hint1',
      fontFamily: "'Kalissa', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 'clamp(36px, 8vw, 88px)',
      color: 'rgba(200, 206, 214, 0.88)',
      text: 'вещь.',
      yPercent: 25,
      xPercent: 78,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
    {
      id: 'pipeline-hint2',
      fontFamily: "'Lora', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 'clamp(16px, 4vw, 24px)',
      color: 'rgba(200, 206, 214, 0.88)',
      text: 'Cобираем и ',
      yPercent: 33,
      xPercent: 22,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
    {
      id: 'pipeline-hint3',
      fontFamily: "'Kalissa', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 40,
      color: 'rgba(200, 206, 214, 0.88)',
      text: 'Металл.',
      yPercent: 53,
      xPercent: 78,
      xOrigin: 'center',
      yOrigin: 'top',
      textAlign: 'center',
      maxWidthPx: 420,
      showAfterSec: 0.55,
      fadeInSec: 0.55,
    },
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
