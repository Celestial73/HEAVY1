/**
 * Все настройки секции «До/После». Редактируйте здесь.
 * Файл ловится HMR — при сохранении страница не перезагружается.
 */
export const COMPARISON_SECTION_SETTINGS = {
  layout: {
    sectionId: 'comparison',
    sectionClassName:
      'relative min-h-svh w-full bg-black px-6 py-24 sm:px-10 sm:py-28 lg:px-16 lg:py-32',
    containerClassName: 'mx-auto flex max-w-6xl flex-col',
    /** Отступы между блоками внутри контейнера. */
    titleAfterClassName: 'mt-10',
    cardSlotClassName: 'mt-16',
    ctaSlotClassName: 'mt-12 flex justify-end',
  },

  /** Кнопка перехода на следующую страницу. */
  cta: {
    text: 'Next',
    to: '/process',
    ariaLabel: 'Перейти к следующей странице',
    className:
      'inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium uppercase tracking-[0.25em] text-white backdrop-blur-md transition hover:bg-white/10 active:scale-95',
  },

  text: {
    title: 'Заголовок',
    titleClassName:
      'font-brand text-5xl uppercase leading-[0.95] tracking-[0.02em] text-white sm:text-7xl lg:text-8xl',

    paragraphs: [
      'Первая строка описания — короткий вступительный тезис.',
      'Вторая строка — раскрываем суть подхода в одном предложении.',
      'Третья строка — финальный аккорд или приглашение посмотреть результат.',
    ],
    paragraphsContainerClassName:
      'max-w-2xl space-y-3 text-base leading-relaxed text-white/70 sm:text-lg',
  },

  card: {
    /** Tailwind-класс пропорций карточки (можно поменять на aspect-square / aspect-[4/5] и т.д.) */
    aspectClassName: 'aspect-[4/3]',
    className:
      'relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-heavy',

    /** Диагональная разметка. По умолчанию идёт из BL в TR. */
    diagonal: {
      /** Полигоны clip-path для половин. Меняй вместе с side у соответствующих половинок. */
      beforeClipPath: 'polygon(0 0, 100% 0, 0 100%)',
      afterClipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
      /** Тонкая разделительная линия (SVG). */
      line: {
        show: true,
        x1: 0,
        y1: 100,
        x2: 100,
        y2: 0,
        stroke: 'rgba(255,255,255,0.22)',
        strokeWidth: 1,
      },
    },

    /**
     * Половины карточки: какой фон, какой side для физики, где лейбл.
     * `side` определяет неравенство для треугольного клампа:
     *   'upper-left'  — cx_frac + cy_frac <= 1
     *   'lower-right' — cx_frac + cy_frac >= 1
     */
    halves: {
      before: {
        side: 'upper-left',
        backgroundClassName: 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black',
        label: {
          text: 'До',
          className:
            'pointer-events-none absolute left-5 top-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/85 backdrop-blur-md',
        },
      },
      after: {
        side: 'lower-right',
        backgroundClassName: 'bg-gradient-to-tl from-amber-900/30 via-zinc-900 to-zinc-950',
        label: {
          text: 'После',
          className:
            'pointer-events-none absolute bottom-5 right-5 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/85 backdrop-blur-md',
        },
      },
    },
  },

  /**
   * Перетаскиваемые объекты внутри половин.
   * `half` — ключ из card.halves.
   * `icon` — ключ из реестра иконок в компоненте: 'feather' | 'kettlebell'.
   * `mass` — основной регулятор «веса» (чем больше, тем сложнее бросить, тише отскок).
   * `physicsOverrides` — точечно переопределяет вычисленные параметры (см. physics.derive).
   */
  objects: [
    {
      id: 'before-feather',
      half: 'before',
      icon: 'feather',
      mass: 0.4,
      ariaLabel: 'Перетащите объект «До»',
      sizeClassName: 'h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32',
      /** Стартовая позиция центра объекта в долях родителя (0..1). */
      initial: { leftFrac: 0.33, topFrac: 0.33 },
      physicsOverrides: {},
    },
    {
      id: 'after-kettlebell',
      half: 'after',
      icon: 'kettlebell',
      mass: 40,
      ariaLabel: 'Перетащите объект «После»',
      sizeClassName: 'h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32',
      initial: { leftFrac: 0.67, topFrac: 0.67 },
      physicsOverrides: {},
    },
  ],

  /**
   * Параметры физики и формулы вывода из массы.
   *
   * Производные параметры:
   *   throwScale  = throwScale.numerator / sqrt(mass)
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
   *   throwVelocityScale — общий множитель импульса при броске (поверх throwScale).
   */
  physics: {
    derive: {
      throwScale: { numerator: 1 },
      decay: { base: 0.85, slope: -0.08, min: 0.3, max: 0.9 },
      restitution: { base: 0.7, slope: -0.09, min: 0.1, max: 0.8 },
      dragSpring: {
        tension: 240,
        dampingRatio: 0.9,
      },
    },
    minSpeed: 6,
    maxStepDt: 0.05,
    /** Множитель импульса от жеста: pxPerSec = gestureVelocityPxPerMs * 1000 * throwVelocityScale * throwScale. */
    throwVelocityScale: 1,
  },
}
