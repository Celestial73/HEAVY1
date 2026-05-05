/**
 * Настройки экрана загрузки (`SectionSplashOverlay`) для секций с WebGPU.
 * Меняйте классы и текст здесь — разметка в `SectionSplashOverlay.jsx`.
 */

const SPINNER_CLASS =
  'h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white/90'

const CONTENT_CLASS = 'flex flex-col items-center gap-5 text-white/90'

const LABEL_CLASS = 'text-xs font-medium uppercase tracking-[0.25em] text-white/70'

/** Базовый пресет: z-40 — выше обычного UI секции (z-10 / z-20). */
export const SECTION_SPLASH_DEFAULTS = {
  enabled: true,
  showSpinner: true,
  label: 'Loading',
  wrapperClassName: 'absolute inset-0 z-40 flex items-center justify-center bg-black',
  contentClassName: CONTENT_CLASS,
  spinnerClassName: SPINNER_CLASS,
  labelClassName: LABEL_CLASS,
}

/**
 * Workflow: z-60 — выше `ProcessSectionTextOverlay` (z-50), пока сцена не готова.
 */
export const WORKFLOW_SECTION_SPLASH = {
  ...SECTION_SPLASH_DEFAULTS,
  wrapperClassName: 'absolute inset-0 z-60 flex items-center justify-center bg-black',
}

/** VolumetricLighting — тот же базовый пресет (явный алиас для импорта). */
export const VOLUMETRIC_SECTION_SPLASH = SECTION_SPLASH_DEFAULTS
