/**
 * Страница «Команда + CTA». Редактируйте контент здесь.
 */
export const TEAM_AND_CTA_SETTINGS = {
  layout: {
    sectionId: 'team-and-cta',
    /**
     * Минимум высота экрана; при переполнении (портреты/подписи) появляется вертикальный скролл.
     * Горизонтальный скролл отключён.
     */
    sectionClassName: 'relative min-h-svh w-full overflow-x-hidden overflow-y-auto bg-black text-zinc-100',
    /**
     * Запас снизу: портреты/подписи + место под закреплённую кнопку.
     * Доп. пустоту **под подписью последней фото** задайте у неё `spaceBelowCaptionVh`.
     */
    containerClassName: 'relative min-h-svh w-full pb-[calc(52vh+6rem)]',
  },

  /**
   * Плавное появление (`animate-fade-up` в `index.css`), по той же идее, что `intro` в Comparison.
   * Страница в App обёрнута в `animate-fade-page` (~0.45s) — задержки лучше держать ≥ 0.45,
   * иначе контент начнёт проявляться на ещё затемнённом экране.
   */
  intro: {
    hero: { delay: 0.5 },
    /**
     * Портреты: если у элемента `portraits[]` нет своего `delay`, используется
     * `delay + index * staggerSec` (сек).
     */
    portraits: { delay: 0.72, staggerSec: 0.18 },
    footer: { delay: 1.15 },
  },

  /** Шапка страницы. `enabled: false` — блок не рендерится. */
  hero: {
    enabled: true,
    title: 'Команда',
    titleClassName:
      'font-brand text-2xl  tracking-[0.06em] text-white sm:text-5xl md:text-6xl',
    subtitle: '',
    subtitleClassName:
      'mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg',
  },

  /**
   * Портреты: позиционирование как у текстов в оверлее.
   *
   * - `xPercent`/`yPercent`: 0..100 (проценты по высоте/ширине «сцены» портретов; сцена ≥ 1× viewport, снизу + padding у `layout.containerClassName`).
   * - `xOrigin`/`yOrigin`: к какой точке блока привязать координату (left/center/right и top/center/bottom).
   *   Если не задано — выбирается автоматически по ближайшей четверти (0/25/50/75/100).
   * - `widthVw`: ширина блока в vw — **число** или **объект** (mobile-first, как Tailwind):
   *   `{ default?: number, sm?: number, md?: number, lg?: number, xl?: number, '2xl'?: number }`
   *   (`default` можно писать как `base`). Пороги в px: sm 640, md 768, lg 1024, xl 1280, 2xl 1536.
   * - `maxWidthPx`: потолок ширины в px (опционально).
   * - `aspectRatio`: CSS `aspect-ratio` (например `3/4`). Если пусто — используется `heightVh`.
   * - `objectFit`: для PNG с прозрачностью обычно нужно `contain` (ничего не обрезается).
   * - `delay` (опционально): задержка fade-in этого портрета в секундах; иначе считается из `intro.portraits`.
   * - `spaceBelowCaptionVh` (опционально, у **любого** элемента `portraits[]`): отступ снизу в `vh`
   *   под подписью этого кадра. Без подписи — отступ под всем блоком `figure`.
   * - `captionClassName`: mobile-first (`text-sm md:text-lg lg:text-2xl`). Не ставьте на десктопе
   *   меньший `text-*`, чем базовый (например `text-3xl` + `lg:text-2xl` уменьшит шрифт на lg).
   */
  portraits: [
    {
      imageUrl: 'images/yolandi_beautiful_1.png',
      imageAlt: 'Yolandi',
      caption: 'Йоланди',
      captionClassName: 'font-kalissa mt-4 pr-4 text-2xl text-zinc-400 md:text-xl lg:text-5xl',
      xPercent: 120,
      yPercent: 9,
      xOrigin: 'right',
      yOrigin: 'top',
      widthVw: {
        default: 85,  // или ключ `base`
        lg: 50,
      },
      aspectRatio: '4/3',
      objectFit: 'contain',
    },
    {
      imageUrl: 'images/dyatlov_beautiful_1.png',
      imageAlt: 'Furnace',
      caption: 'А.С. Дятлов',
      captionClassName: 'font-kalissa pl-4 mt-2 text-zinc-400 text-2xl md:text-xl lg:text-5xl',
      xPercent: 1,
      yPercent: 40,
      xOrigin: 'left',
      yOrigin: 'top',
      widthVw: {
        default: 80,  // или ключ `base`
        lg: 54,
      },
      aspectRatio: '3/4',
      objectFit: 'contain',
      spaceBelowCaptionVh: 10,
    },
  ],

  /** Поле для позиционирования портретов (на весь viewport). */
  portraitsStageClassName: 'absolute inset-0',
  /** Отступы, которые считаем «безопасной зоной» для процентов (в пикселях). */
  portraitsStageInsetPx: 24,

  /** Без рамки/заливки — PNG ложится прямо на фон секции. */
  portraitFrameClassName: 'relative w-full overflow-hidden bg-transparent',

  /** Нижний блок: только кнопка */
  footer: {
    buttonText: 'Заказать утяжеление',
    /** Внутренний путь (`/pipeline` и т.д.) или `mailto:…` / `https://…` */
    to: 'https://t.me/bailem0s',
    buttonClassName:
      'mb-4 inline-flex h-12 w-full max-w-md items-center justify-center rounded-full border border-white/20 bg-white px-8 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-100 active:scale-[0.98] sm:w-auto',
  },
}
