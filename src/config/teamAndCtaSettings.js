/**
 * Страница «Команда + CTA». Редактируйте контент здесь.
 */
export const TEAM_AND_CTA_SETTINGS = {
  layout: {
    sectionId: 'team-and-cta',
    sectionClassName: 'flex min-h-svh w-full flex-col bg-black text-zinc-100',
    containerClassName:
      'mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-6 py-16 sm:gap-16 sm:px-10 sm:py-20 md:gap-20 md:py-24',
  },

  intro: {
    hero: { delay: 0.5 },
    portraits: { delay: 0.85 },
    footer: { delay: 1.1 },
    nav: { delay: 1.25 },
  },

  /** Шапка страницы */
  hero: {
    title: 'В команде:',
    titleClassName:
      'font-brand text-4xl uppercase tracking-[0.06em] text-white sm:text-5xl md:text-6xl',
    subtitle: '',
    subtitleClassName:
      'mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg',
  },

  /**
   * Два портрета по вертикали: 1-й — к правому краю, 2-й — к левому (`portraitAlternateSides`).
   */
  portraits: [
    {
      imageUrl: 'images/yolandi.png',
      imageAlt: 'Yolandi',
      caption: 'Йолади, die antwoord',
      captionClassName: 'mt-4 text-sm text-zinc-400 sm:text-base',
    },
    {
      imageUrl: 'images/furnace.jpg',
      imageAlt: 'Furnace',
      caption: 'Печь "Спутник" - G1200 градусов',
      captionClassName: 'mt-4 text-sm text-zinc-400 sm:text-base',
    },
  ],

  /** Обёртка полосы портретов (на всю ширину экрана, с боковыми отступами). */
  portraitsStripClassName: 'flex w-full flex-col gap-12 sm:gap-14',

  /** Ширина кадра: `min(portraitWidthVw vw, portraitMaxWidthPx)` — на широких экранах не разъезжается по X. */
  portraitWidthVw: 60,

  /** Верхняя граница ширины кадра (px); `null` — только vw. */
  portraitMaxWidthPx: 560,

  /** true: чётные по порядку — к правому краю, нечётные — к левому. */
  portraitAlternateSides: true,

  /**
   * Пропорции кадра (CSS `aspect-ratio`, напр. `3/4`). Пусто — только фикс. высота `portraitHeightVh`.
   */
  portraitAspectRatio: '3/4',

  /** Потолок высоты при `portraitAspectRatio` (vh), чтобы на низких экранах не вылезало. */
  portraitMaxHeightVh: 78,

  /** Высота кадра (vh), если `portraitAspectRatio` не задан. */
  portraitHeightVh: 20,

  portraitFrameClassName:
    'relative w-full overflow-hidden border border-white/10 bg-zinc-900/40',

  /** Нижний блок: только кнопка */
  footer: {
    buttonText: 'Заказать утяжеление',
    /** Внутренний путь (`/workflow`) или `mailto:…` / `https://…` */
    to: 'https://t.me/bailem0s',
    buttonClassName:
      'inline-flex h-12 w-full max-w-md items-center justify-center rounded-full border border-white/20 bg-white px-8 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-100 active:scale-[0.98] sm:w-auto',
  },

  /** Опционально: ссылка «назад» в потоке сайта. */
  nav: {
    back: {
      to: '/',
      label: 'К 3д объектам',
      className:
        'inline-flex text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-300',
    },
  },
}
