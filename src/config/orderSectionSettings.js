/**
 * Страница «Заказать утяжеление». Редактируйте контакты здесь.
 */
export const ORDER_SECTION_SETTINGS = {
  layout: {
    sectionId: 'order',
    sectionClassName: 'relative min-h-svh w-full overflow-x-hidden bg-black text-zinc-100',
    containerClassName:
      'mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-10 px-6 py-20 sm:max-w-lg sm:px-10',
  },

  intro: {
    hero: { delay: 0.5 },
    options: { delay: 0.72, staggerSec: 0.14 },
  },

  hero: {
    title: 'Заказать утяжеление',
    subtitle: 'Выберите удобный способ связи',
    titleClassName: 'font-brand text-4xl uppercase leading-none tracking-[0.06em] text-white sm:text-5xl',
    subtitleClassName: 'mt-4 font-montserrat text-base leading-relaxed text-white/70 sm:text-lg',
  },

  /** Письма с формы звонка уходят на `contact.email` (через FormSubmit.co). */
  contact: {
    telegram: 'https://t.me/bailem0s',
    email: 'lead-elephant@mail.ru',
  },

  optionButtonClassName:
    'group flex w-full flex-col gap-1 rounded-2xl border border-white/15 bg-white/5 px-6 py-5 text-left transition hover:border-white/30 hover:bg-white/10 active:scale-[0.99]',
  optionLabelClassName: 'font-st-rome text-xl text-white sm:text-2xl',
  optionDescriptionClassName: 'font-montserrat text-sm leading-relaxed text-white/65 sm:text-base',

  options: [
    {
      id: 'telegram',
      type: 'link',
      label: 'Telegram',
      description: '@bailem0s',
      hrefKey: 'telegram',
      openInNewTab: true,
    },
    {
      id: 'email',
      type: 'link',
      label: 'Почта',
      description: 'lead-elephant@mail.ru',
      hrefKey: 'email',
      mailto: true,
    },
    {
      id: 'callback',
      type: 'callback',
      label: 'Обратный звонок',
      description: 'Перезвоним как будет настроение',
      submitLabel: 'Заказать звонок',
      loadingLabel: 'Отправка…',
      successMessage: 'Заявка отправлена. Перезвоним, как будет настроение.',
      emailSubject: 'Заказать обратный звонок',
      phonePlaceholder: '+7 (___) ___-__-__',
    },
  ],
}
