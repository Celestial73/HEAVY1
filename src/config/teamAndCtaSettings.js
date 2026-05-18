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
    containerClassName: 'relative min-h-svh w-full',
    /** Нижний отступ сцены (портреты + кнопка). Строка CSS, обычно `clamp(...)`. */
    containerPaddingBottom: 'clamp(14rem, calc(52vh + 4rem), 36rem)',
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
    titleClassName: 'font-brand tracking-[0.06em] text-white',
    titleFontSize: 'clamp(1rem, 6vw, 10rem)',
    subtitle: '',
    subtitleClassName: 'mt-2 max-w-2xl leading-relaxed text-zinc-400',
    subtitleFontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
  },

  /**
   * Портреты: позиционирование как у текстов в оверлее.
   *
   * - `xPercent`/`yPercent`: 0..100 (проценты по высоте/ширине «сцены» портретов; сцена ≥ 1× viewport, снизу + padding у `layout.containerClassName`).
   * - `xOrigin`/`yOrigin`: к какой точке блока привязать координату (left/center/right и top/center/bottom).
   *   Если не задано — выбирается автоматически по ближайшей четверти (0/25/50/75/100).
   * - `width`: ширина блока — строка CSS (`clamp(16rem, 85vw, 42rem)` и т.п.), предпочтительно.
   * - `widthVw`: устаревший вариант (число или mobile-first объект); если задан `width`, не используется.
   * - `maxWidthPx` / `maxWidth`: потолок ширины (число px или CSS-строка).
   * - `captionFontSize`: размер подписи (`clamp(...)`).
   * - `aspectRatio`: CSS `aspect-ratio` (например `3/4`). Если пусто — используется `heightVh`.
   * - `objectFit`: для PNG с прозрачностью обычно нужно `contain` (ничего не обрезается).
   * - `delay` (опционально): задержка fade-in этого портрета в секундах; иначе считается из `intro.portraits`.
   * - `spaceBelowCaption` / `spaceBelowCaptionVh`: отступ под подписью (CSS-строка или число vh).
   * - `captionClassName`: семейство, цвет, отступы — без responsive `text-*` (размер в `captionFontSize`).
   */
  portraits: [
    {
      imageUrl: 'images/yolandi_beautiful_1.png',
      imageAlt: 'Yolandi',
      caption: 'Йоланди',
      captionClassName: 'font-kalissa mt-4 pr-4 text-zinc-400',
      captionFontSize: 'clamp(1.25rem, 2.8vw, 100rem)',
      xPercent: 120,
      yPercent: 9,
      xOrigin: 'right',
      yOrigin: 'top',
      width: 'clamp(30rem, 60vw, 1000rem)',
      aspectRatio: '4/3',
      objectFit: 'contain',
    },
    {
      imageUrl: 'images/dyatlov_beautiful_1.png',
      imageAlt: 'Furnace',
      caption: 'А.С. Дятлов',
      captionClassName: 'font-kalissa pl-4 mt-2 text-zinc-400',
      captionFontSize: 'clamp(1.25rem, 2.8vw, 100rem)',
      xPercent: 1,
      yPercent: 40,
      xOrigin: 'left',
      yOrigin: 'top',
      width: 'clamp(20rem, 60vw, 1000rem)',
      aspectRatio: '3/4',
      objectFit: 'contain',
      spaceBelowCaption: 'clamp(2rem, 10vh, 8rem)',
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
      'inline-flex h-12 w-auto max-w-[calc(100vw-1.5rem)] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-white/20 bg-white px-4 font-semibold uppercase tracking-[0.12em] text-black transition hover:bg-zinc-100 active:scale-[0.98] sm:px-8 sm:tracking-[0.16em]',
    buttonFontSize: 'clamp(0.625rem, 2.8vw, 0.875rem)',
  },
}
