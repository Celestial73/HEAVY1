/**
 * Секция «Портфолио». Редактируйте контент и координаты здесь.
 *
 * Координаты (одинаково для всех блоков и `hero`):
 *  - `xPercent` — % ширины сцены; допускаются **< 0** и **> 100** (блок за краем экрана).
 *  - `yPercent` — вертикаль в «экранах»: 0 = верх, 100 = один viewport ниже, 200 = два и т.д.
 *  - `xOrigin` / `yOrigin` — left|center|right и top|center|bottom (якорь блока).
 *
 * Responsive-позиция — вариант 1, объект `position`:
 *  - `position: { default: { xPercent: 5, yPercent: 40 }, md: { xPercent: 0, yPercent: 28 } }`
 *  - поля `xPercent`/`yPercent` на блоке = default; `position.md` перекрывает на ≥768px
 *
 * Responsive-позиция — вариант 2, по полям:
 *  - `xPercent: { default: 5, md: 0 }`, `yPercent: { default: 40, md: 28 }`
 *
 * Пороги: sm 640, md 768, lg 1024, xl 1280, 2xl 1536 (px).
 *  - `scrollExtentVh` — сколько vh ниже `yPercent` занимает блок (для авто-высоты скролла).
 *  - `zIndex` — порядок наложения (число; выше — поверх).
 *
 * Ширина блока (удобнее, чем clamp):
 *  - `widthVw: 45` — 45% ширины экрана; можно **>100** (напр. `120` = 120vw).
 *  - `widthVw: { default: 80, md: 45 }` — responsive через CSS @media (пороги как у Tailwind: md = 768px).
 *  - `allowWiderThanViewport: true` — не обрезать ширину до 100vw (выступ за край **обрезается**, горизонтальный скролл отключён).
 *  - `widthPx: 320` — фиксированная ширина в px.
 *  - `width: '24rem'` / `'45vw'` — произвольная CSS-строка.
 *  - `maxWidthPx` — опциональный потолок (только если явно задан у блока).
 *
 * Типографика в `descriptionDefaults` / блоках:
 *  - mobile-first: размер БЕЗ префикса = мобилка (`text-xl`), дальше `md:`, `lg:`.
 *  - Новые `sm:`/`md:`/`lg:` классы добавляйте в `portfolioTailwindClasses.js`.
 *  - Или используйте `titleFontSize` / `descriptionFontSize` с `clamp(...)` (как у `hero`).
 *
 * Типы блоков в `blocks[]`:
 *  - `image` — картинка предмета (`flipHorizontal`, `flipVertical`).
 *  - `description` — заголовок + описание (`PortfolioDescription`).
 *  - `text` — произвольный текст.
 */
export const PORTFOLIO_SECTION_SETTINGS = {
  layout: {
    sectionId: 'portfolio',
    sectionClassName: 'relative w-full overflow-y-auto bg-black text-zinc-100',
    stageClassName: 'relative w-full overflow-x-hidden',
    /** Минимальная высота сцены (vh). Итог = max(это, блоки + padding). */
    minScrollHeightVh: 100,
    /** Запас снизу под кнопки CTA / Next. */
    bottomPaddingVh: 20,
    /** Явная высота сцены (vh); `null` — считается по блокам. */
    stageHeightVh: null,
    stageInsetPx: 24,
  },

  intro: {
    hero: { delay: 0.5 },
    blocks: { delay: 0.65, staggerSec: 0.12 },
  },

  hero: {
    enabled: true,
    title: 'Работы',
    titleClassName: 'font-brand text-left uppercase leading-none tracking-[0.06em] text-white',
    titleFontSize: 'clamp(4rem, 7vw, 4.5rem)',
    xPercent: 5,
    yPercent: 5,
    xOrigin: 'left',
    yOrigin: 'top',
    sticky: false,
    zIndex: 10,
  },

  descriptionDefaults: {
    titleClassName: 'font-st-rome text-3xl leading-tight text-white md:text-3xl lg:text-5xl',
    descriptionClassName:
      'mt-3 whitespace-pre-line font-montserrat text-base leading-relaxed text-white/85 text-lg md:text-lg lg:text-2xl',
    widthVw: 48,
  },

  imageDefaults: {
    objectFit: 'contain',
    widthVw: 40,
    frameClassName: 'relative w-full overflow-hidden',
  },

  textDefaults: {
    className: 'whitespace-pre-line font-montserrat text-base leading-relaxed text-white/80 sm:text-lg',
    widthVw: 50,
  },

  blocks: [
    {
      type: 'image',
      id: 'item-1-photo',
      xPercent: 70,
      yPercent:-20,
      position: {
        default: { xPercent: 70, yPercent: -25 },
        md: { xPercent: 83, yPercent: -25 },
        lg: { xPercent: 83, yPercent: -40 },
      },
      xOrigin: 'center',
      yOrigin: 'top',
      imageUrl: '/images/phone_case.png',
      imageAlt: 'Чехол на телефон',
      widthVw: { default: 50, md: 50, lg: 25 },
      maxWidthPx: 1000,
      aspectRatio: '1/3',
      scrollExtentVh: 48,
      zIndex: 2,
    },
    {
      type: 'image',
      id: 'item-1-photo-2',

      position: {
        default: { xPercent: 70, yPercent: 35 },
        md: { xPercent: 55, yPercent: -20 },
        lg: { xPercent: 55, yPercent: -30 },
      },
      xOrigin: 'center',
      yOrigin: 'top',
      imageUrl: '/images/phone_case_close2.png',
      imageAlt: 'Чехол на телефон, крупный план',
      widthVw: { default: 50, md: 50, lg: 25 },
      maxWidthPx: 1000,
      aspectRatio: '1/3',
      scrollExtentVh: 48,
      zIndex: 1,
      flipHorizontal: true,
    },
    {
      type: 'description',
      id: 'item-1-desc',
      xPercent: 5,
      yPercent: 40,
      xOrigin: 'left',
      yOrigin: 'top',
      position: {
        default: { xPercent: 5, yPercent: 42 },

      },
      title: 'Чехол на телефон',
      description: '+1.5 кг.\nСвинец, сталь, эпоксидная смола.',
      widthVw: { default: 40, md: 10, lg: 80 },
      scrollExtentVh: 32,
      zIndex: 3,
    },
    {
      type: 'image',
      id: 'item-2-photo',
      position: {
        default: { xPercent: -50, yPercent: 80 },
        md: { xPercent: -50, yPercent: 80 },
        lg: { xPercent: -50, yPercent: 10 },
      },
      xOrigin: 'left',
      yOrigin: 'top',
      
      imageUrl: '/images/airpods_case.png',
      imageAlt: 'Чайник',
      widthVw: { default: 150, md: 150, lg: 150 },
      allowWiderThanViewport: true,
      aspectRatio: '4/5',
      scrollExtentVh: 50,
    },
    {
      type: 'description',
      id: 'item-2-desc',
      position: {
        default: { xPercent: 58, yPercent: 120 },
        md: { xPercent: 58, yPercent: 150 },
        lg: { xPercent: 58, yPercent: 170 },
      },
      xOrigin: 'left',
      yOrigin: 'top',
      title: 'Чехол Airpods',
      description: '+1кг.\nСвинец, эпоксидная смола.',
      widthVw: 36,
      maxWidthPx: 400,
      scrollExtentVh: 30,
    },

  ],
}
