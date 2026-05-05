/**
 * Страница «Команда + CTA». Редактируйте контент здесь.
 */
export const TEAM_AND_CTA_SETTINGS = {
  layout: {
    sectionId: 'team-and-cta',
    sectionClassName: 'min-h-svh w-full bg-black text-zinc-100',
    containerClassName:
      'mx-auto flex max-w-5xl flex-col gap-14 px-6 py-16 sm:gap-16 sm:px-10 sm:py-20 md:gap-20 md:py-24',
  },

  intro: {
    hero: { delay: 0.5 },
    teamGrid: { delay: 0.85 },
    ctaBlock: { delay: 1.15 },
    nav: { delay: 1.35 },
  },

  hero: {
    title: 'Команда',
    titleClassName:
      'font-brand text-4xl uppercase tracking-[0.06em] text-white sm:text-5xl md:text-6xl',
    subtitle:
      'Люди, которые ведут проекты от идеи до запуска. Замените тексты и список в `teamAndCtaSettings.js`.',
    subtitleClassName:
      'mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg',
  },

  /**
   * Карточка: `imageUrl` (опционально, из `public/`) или `initials` (2–3 буквы).
   */
  team: [
    { name: 'Имя Фамилия', role: 'Роль / направление', initials: 'ИФ' },
    { name: 'Имя Фамилия', role: 'Роль / направление', initials: 'ИФ' },
    { name: 'Имя Фамилия', role: 'Роль / направление', initials: 'ИФ' },
    { name: 'Имя Фамилия', role: 'Роль / направление', initials: 'ИФ' },
  ],

  teamGridClassName:
    'grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4',

  cta: {
    headline: 'Готовы обсудить задачу?',
    headlineClassName: 'text-2xl font-medium text-white sm:text-3xl',
    body: 'Опишите проект — ответим с идеями по формату и срокам.',
    bodyClassName: 'mt-3 max-w-xl text-zinc-400',
    /** Внутренний путь (`/workflow`) или `mailto:…` / `https://…` */
    buttonText: 'Написать нам',
    to: 'mailto:hello@example.com',
    buttonClassName:
      'mt-8 inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white px-8 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-100 active:scale-[0.98]',
  },

  /** Опционально: ссылка «назад» в потоке сайта. */
  nav: {
    back: {
      to: '/',
      label: 'На главную',
      className:
        'inline-flex text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-300',
    },
  },
}
