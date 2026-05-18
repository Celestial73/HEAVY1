/**
 * Все настройки секции «До/После». Редактируйте здесь.
 * Файл ловится HMR — при сохранении страница не перезагружается.
 */
const COMPARISON_OBJECT_IMAGE_SRC = '/images/—Pngtree—ceramic vase_16234345.png'
/** Tailwind-классы для `<img>` внутри draggable (размер/обрезка/тень). */
const COMPARISON_OBJECT_IMAGE_CLASS_NAME =
  'h-full w-full object-contain drop-shadow-[0_6px_22px_rgba(0,0,0,0.55)]'

export const COMPARISON_SECTION_SETTINGS = {
  /**
   * Раскладка: секция занимает ровно вьюпорт (h-svh). Внутри два блока —
   * текст и карточка.
   *
   *  - mobile (< lg): flex-col. Текст сверху, карточка снизу.
   *    Пропорция 50/50, чтобы карточка получила достаточно высоты для
   *    выразительной диагонали (иначе она была бы «широкой и плоской»).
   *  - desktop (≥ lg): flex-row. Текст слева 65%, карточка справа 35%.
   *    На широких экранах карточка и так вертикально вытянута, лишняя
   *    ширина ей не нужна.
   *
   * Доли заданы через `flex-[X_1_0]` (grow-shrink-basis).
   * `min-h-0` / `min-w-0` нужны, чтобы вложенные flex-контейнеры могли
   * сжиматься меньше своего контента и не ломать layout.
   */
  layout: {
    sectionId: 'comparison',
    sectionClassName: 'relative h-svh w-full overflow-hidden bg-black',
    containerClassName:
      'flex h-full w-full flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16 md:flex-row md:items-stretch md:gap-14 md:px-16 md:py-20',
    /** Текстовый блок: 50% высоты на мобиле / 65% ширины на десктопе. `h-full` — колонка на всю высоту слота; параграфы растягиваются внутри через `paragraphsContainerClassName`. */
    textBlockClassName:
      'flex h-full min-h-0 min-w-0 flex-[50_1_0] flex-col gap-6 md:flex-[65_1_0]',
    /**
     * Слот карточки: 50% высоты на мобиле / 35% ширины на десктопе.
     * Нижний padding оставляет место под фиксированные кнопки CTA / Next.
     * Колонка из самой карточки и кнопки Next.
     * `items-stretch` — карточка тянется на всю ширину слота.
     * `flex-col` — кнопка располагается ПОД карточкой.
     */
    cardSlotClassName:
      'flex min-h-0 min-w-0 flex-[50_1_0] flex-col items-stretch gap-4 pb-6 md:flex-[35_1_0] md:pb-14',
    /** Обёртка вокруг ComparisonCard внутри cardSlot — забирает всё свободное место по высоте. */
    cardFrameClassName: 'min-h-0 min-w-0 w-full flex-1',
    /** Слот CTA-кнопки под карточкой: справа, фиксированная высота (shrink-0). */
    ctaSlotClassName: 'flex shrink-0 justify-end',
  },

  /**
   * Задержки fade-in каждого визуального элемента (в секундах).
   * Анимация — Tailwind-утилита `animate-fade-up` (см. `src/index.css`).
   *
   * Учти: оборачивающий `animate-fade-page` в App.jsx сам прогоняет fade
   * страницы за ~0.45с. Поэтому имеет смысл ставить задержки ≥ 0.45,
   * иначе элемент начнёт появляться, пока ещё затемнён весь экран.
   *
   *  - title.delay   — задержка заголовка.
   *  - card.delay    — задержка появления карточки.
   *  - cta.delay     — задержка появления кнопки Next.
   *
   * Задержка каждого параграфа задаётся отдельно в `text.paragraphs[]`,
   * поле `delay` у каждого элемента (сек).
   */
  intro: {
    title: { delay: 0.5 },
    card: { delay: 1.1 },
    cta: { delay: 1.5 },
  },

  /** Кнопка перехода на следующую страницу. */
  cta: {
    text: 'Next',
    to: '/pipeline',
    ariaLabel: 'Перейти к следующей странице',
    className:
      'inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium uppercase tracking-[0.25em] text-white backdrop-blur-md transition hover:bg-white/10 active:scale-95',
  },

  text: {
    title: 'Об Агентстве',
    /**
     * Outline-заголовок: `font-brand` (Bebas), без заливки, белая обводка.
     * Итоговая «полупрозрачность» задаётся анимацией `animate-fade-up-half` в JSX
     * (не через `opacity-*`: обычный `animate-fade-up` в конце ставит opacity: 1 и перебивает класс).
     */
    titleClassName:
      'font-brand text-5xl uppercase leading-[0.95] tracking-[0.02em] text-transparent [-webkit-text-stroke:0.5px_white] sm:text-7xl sm:[-webkit-text-stroke:1px_white] lg:text-8xl lg:[-webkit-text-stroke:2.5px_white] drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]',

    /**
     * Вертикальное распределение: `flex-1` + `justify-evenly` — свободная высота
     * делится на равные зазоры: от верхнего края до 1-го параграфа, между соседними
     * параграфами и от последнего до нижнего края (всё с одинаковым шагом).
     * У `justify-between` от краёв зазор был бы 0, что не совпадало бы с шагом между строками.
     */
    paragraphsContainerClassName:
      'flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-evenly',

    /**
     * Общая типографика без семейства шрифта — `font-*` задаётся у каждого параграфа
     * в `paragraphs[].className`. Иначе `font-museo-cyrl` из базы побеждает `font-kalissa`
     * и др. в финальном CSS Tailwind (не из‑за порядка классов в строке).
     */
    paragraphBaseClassName: 'font-medium leading-relaxed text-white/90 sm:text-lg',

    /**
     * Каждый параграф настраивается отдельно:
     *  - `text`   — содержимое
     *  - `delay`  — задержка fade-in (сек)
     *  - `className` — опционально, дополнительные Tailwind-классы (добавляются к base)
     *  - `style`  — inline-стили, напр. `{ fontWeight: 400 }` (перебивает `font-medium` из base)
     */
    paragraphs: [
      {
        text: 'Мы делаем вещи тяжелее',
        delay: 0.7,
        className: 'font-st-rome text-white text-3xl text-right sm:text-xl',
      },
      {
        text: 'Реально тупо увеличиваем вес вещей',
        delay: 0.88,
        className: 'font-coolvetica text-l lg:text-xl text-white/75',
        style: { fontWeight: 400 },
      },
      {
        text: 'И всё.',
        delay: 1.06,
        className: 'font-kalissa text-right text-7xl sm:text-7xl md:text-7xl lg:text-8xl t racking-[0.2em] text-white/50',
      },
    ],
  },

  card: {
    /** Прозрачная карточка: только заметная белая обводка по периметру (класс ниже). */
    className:
      'relative h-full w-full overflow-hidden rounded-3xl border-2 border-white bg-transparent',

    /** Диагональная разметка. По умолчанию идёт из BL в TR. */
    diagonal: {
      /** Полигоны clip-path для половин. Меняй вместе с side у соответствующих половинок. */
      beforeClipPath: 'polygon(0 0, 100% 0, 0 100%)',
      afterClipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
      /** Линия по диагонали — в тон рамке (белая, non-scaling stroke). */
      line: {
        show: true,
        x1: 0,
        y1: 100,
        x2: 100,
        y2: 0,
        stroke: 'rgba(255,255,255,1)',
        strokeWidth: 2,
      },
    },

    /**
     * Половины карточки: фон убран (`bg-transparent`).
     * `side` определяет неравенство для треугольного клампа:
     *   'upper-left'  — cx_frac + cy_frac <= 1
     *   'lower-right' — cx_frac + cy_frac >= 1
     */
    halves: {
      before: {
        side: 'upper-left',
        backgroundClassName: 'bg-transparent',
      },
      after: {
        side: 'lower-right',
        backgroundClassName: 'bg-transparent',
      },
    },
  },

  /**
   * Перетаскиваемые объекты внутри половин.
   * `half` — ключ из card.halves.
   * `icon` — ключ из реестра иконок в компоненте: 'feather' | 'kettlebell' (если не задан `imageSrc`).
   * `imageSrc` — путь к картинке в `public/` (один и тот же файл можно использовать в обеих половинах).
   * `imageClassName` — опционально: переопределить `objectsImageClassName` для конкретного объекта.
   * `sizeClassByScreen` — адаптивные размеры по брейкпоинтам:
   *   { base, sm, md, lg, xl }, где значения — tailwind-пары вида 'h-20 w-20'.
   *   Если задано, имеет приоритет над `sizeClassName`.
   * `mass` — основной регулятор «веса» (чем больше, тем сложнее бросить, тише отскок).
   * `physicsOverrides` — точечно переопределяет вычисленные параметры (см. physics.derive).
   */
  objectsImageClassName: COMPARISON_OBJECT_IMAGE_CLASS_NAME,
  objects: [
    {
      id: 'before-vase',
      half: 'before',
      imageSrc: COMPARISON_OBJECT_IMAGE_SRC,
      mass: 0.4,
      ariaLabel: 'Перетащите объект «До»',
      sizeClassByScreen: {
        base: 'h-20 w-20',
        sm: 'h-24 w-24',
        md: 'h-28 w-28',
        lg: 'h-32 w-32',
      },
      /** Стартовая позиция центра объекта в долях родителя (0..1). */
      initial: { leftFrac: 0.33, topFrac: 0.33 },
      physicsOverrides: {},
    },
    {
      id: 'after-vase',
      half: 'after',
      imageSrc: COMPARISON_OBJECT_IMAGE_SRC,
      mass: 40,
      ariaLabel: 'Перетащите объект «После»',
      sizeClassByScreen: {
        base: 'h-20 w-20',
        sm: 'h-24 w-24',
        md: 'h-28 w-28',
        lg: 'h-32 w-32',
      },
      initial: { leftFrac: 0.67, topFrac: 0.67 },
      physicsOverrides: {},
    },
  ],

  /**
   * Параметры физики и формулы вывода из массы.
   *
   * Производные параметры:
   *   throwScale  = throwScale.numerator / mass^massExponent
   *                 (при exponent 0.5 это 1/√m; меньший exponent — слабее штраф за тяжесть)
   *   decay       = clamp(decay.base + decay.slope * mass, decay.min, decay.max)
   *   restitution = clamp(restitution.base + restitution.slope * mass, restitution.min, restitution.max)
   *
   * Драг-инерция (react-spring при удержании):
   *   tension    — жёсткость пружины, тянущей объект к курсору.
   *   dampingRatio — коэффициент демпфирования: 1 — критическое (без переколебаний),
   *                  <1 — лёгкие переколебания, >1 — переторможено.
   *   friction = 2 * dampingRatio * sqrt(mass * tension)
   *   ⇒ чем тяжелее объект, тем сильнее он отстаёт от курсора при перетаскивании.
   *
   * Глобальные:
   *   minSpeed   — порог остановки (px/sec).
   *   maxStepDt  — кап dt в секундах, защита от больших шагов (свёрнутая вкладка).
   *   rectInsetPx — отступ центра объекта от внешних границ своей половины.
   *                 0 = можно вплотную к внешним стенкам/углам (визуально),
   *                 r(радиус) = объект всегда полностью внутри.
   *   throwVelocityScale — общий множитель импульса при броске (поверх throwScale).
   *   triangleInsetPx — отступ центра объекта от диагонали в пикселях.
   *                     0 = можно доходить до диагонали (и углов у диагонали),
   *                     большие значения сужают область по обе стороны.
   */
  physics: {
    derive: {
      throwScale: {
        numerator: 2.2,
        /** Чем меньше, тем слабее ограничение скорости броска для тяжёлых (0.5 ≈ √mass). */
        massExponent: 0.36,
      },
      decay: { base: 0.88, slope: -0.045, min: 0.62, max: 0.92 },
      restitution: { base: 0.7, slope: -0.09, min: 0.1, max: 0.8 },
      dragSpring: {
        tension: 240,
        dampingRatio: 0.9,
      },
    },
    minSpeed: 6,
    maxStepDt: 0.05,
    rectInsetPx: 0,
    triangleInsetPx: 0,
    /** Множитель импульса от жеста: pxPerSec = gestureVelocityPxPerMs * 1000 * throwVelocityScale * throwScale. */
    throwVelocityScale: 1.4,
  },
}
