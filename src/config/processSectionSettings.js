const PROCESS_TEXT_HIDE_AFTER_SEC = 18

/**
 * Свет для `WorkflowSection` (фиксированные источники без орбиты).
 * Вынесен сюда, чтобы управлять положением/силой из одного конфига.
 */
export const WORKFLOW_LIGHT_SETTINGS = {
  /**
   * На мобильном размер карт теней у источников с castShadow (дешевле GPU).
   * Не отключайте castShadow у всех светов: в three.js volumetric умножает свет на shadowNode;
   * без теней shadowNode остаётся null и объёмный свет пропадает.
   */
  mobileShadowMapSize: 256,
  pointLights: [
    {
      color: 0xffffff,
      intensity: 0.5,
      distance: 100,
      castShadow: true,
      initialPosition: [2.5, 6, 2],
    },
    {
      color: 0xffffff,
      intensity: 0.5,
      distance: 100,
      castShadow: true,
      initialPosition: [-2, 1,2],
    },
    {
      color: 0xffffff,
      intensity: 0.5,
      distance: 100,
      castShadow: true,
      initialPosition: [1, 0, 1],
    },
    {
      color: 0xffffff,
      intensity: 0.5,
      distance: 100,
      castShadow: true,
      initialPosition: [-1, -4, 1],
    },
    {
      color: 0xffffff,
      intensity: 0.5,
      distance: 100,
      castShadow: true,
      initialPosition: [1, -6, 3],
    },
  ],
  /**
   * Прожекторы Workflow: стартуют с intensity 0, затем через `onAfterSec` (сек от старта рендера)
   * нарастают до `intensity` за `fadeInSec` (0 — сразу полная яркость после задержки).
   * Одна общая `spotColorMap` для всех.
   */
  spotLights: [
    {
      color: 0xffffff,
      intensity: 3,
      angle: Math.PI / 4,
      penumbra: 1,
      decay: 1,
      distance: 20,
      castShadow: true,
      restPosition: [5, 6, 5],
      target: [-2, 4, 0],
      onAfterSec: 3,
      fadeInSec: 2,
    },
    {
      color: 0xffffff,
      intensity: 3,
      angle: Math.PI / 4,
      penumbra: 1,
      decay: 1,
      distance: 20,
      castShadow: true,
      restPosition: [-4, -3, 3],
      target: [1, -2, 0],
      onAfterSec: 10,
      fadeInSec: 3,
    },
  ],
  spotColorMap: {
    size: 256,
    gradient: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.45, color: '#ffffff' },
      { offset: 1, color: '#ffffff' },
    ],
  },
}

/** Workflow: текстовые подсказки в центрированной колонке на широком экране (позиции как на «мобильной» ширине). */
export const WORKFLOW_TEXT_OVERLAY_COLUMN_MAX_PX = 440

/**
 * Правки оверлея только для Workflow: удобный список «абзацев» (`id` = тот же, что в `textOverlays`).
 * Сюда кладите только поля, которые нужно переопределить относительно базового элемента.
 */
export const WORKFLOW_TEXT_OVERLAY_PARAGRAPHS = [
  { id: 'hint-01', xPercent: 50, xOrigin: 'center', maxWidthPx: 400 },
  { id: 'hint-03', xPercent: 95, xOrigin: 'right' },
  { id: 'hint-05', xPercent: 97, xOrigin: 'right' },
  { id: 'hint-08', xPercent: 100, xOrigin: 'right' },
  { id: 'hint-10', xPercent: 100, xOrigin: 'right' },
]

function buildWorkflowTextOverlayOverridesById(paragraphs) {
  const out = {}
  for (const row of paragraphs) {
    if (!row || row.id == null || row.id === '') continue
    const { id, ...patch } = row
    out[id] = patch
  }
  return out
}

/** Внутреннее: карта для подмешивания в `WorkflowSection` (из `WORKFLOW_TEXT_OVERLAY_PARAGRAPHS`). */
export const WORKFLOW_TEXT_OVERLAY_OVERRIDES_BY_ID =
  buildWorkflowTextOverlayOverridesById(WORKFLOW_TEXT_OVERLAY_PARAGRAPHS)

/**
 * На мобильном (`isWorkflowMobileProfile`) не строить volumetric pass — только обычный рендер сцены.
 * При `true` рендер на телефоне использует те же настройки качества, что и `WORKFLOW_VOLUMETRIC_SETTINGS`
 * (antialias, DPR, PCF и т.д.); `WORKFLOW_VOLUMETRIC_MOBILE_OVERRIDES` применяются только если volumetric на мобильном включён.
 */
export const WORKFLOW_DISABLE_VOLUMETRIC_ON_MOBILE = false

/**
 * Настройки volumetric-части `WorkflowSection`.
 */
export const WORKFLOW_VOLUMETRIC_SETTINGS = {
  layerIndex: 10,
  renderer: {
    antialias: true,
    maxPixelRatio: 2,
    toneMapping: 'neutral',
    toneMappingExposure: 2,
    shadowMapEnabled: true,
    shadowMapType: 'pcf',
  },
  noiseTexture3D: {
    size: 128,
    perlinScale: 10,
    repeatFactor: 5,
    format: 'red',
    minFilter: 'linear',
    magFilter: 'linear',
    wrapS: 'repeat',
    wrapT: 'repeat',
    unpackAlignment: 1,
  },
  volume: {
    rayMarchSteps: 12,
    smokeAmount: 0.02,
    timeScroll: { x: 1, y: 0, z: 0.3 },
    grainSamples: [
      { scale: 0.1, timeScale: 1 },
      { scale: 0.05, timeScale: 1 },
      { scale: 0.02, timeScale: 2 },
    ],
  },
  volumetricBox: {
    width: 20,
    height: 20,
    depth: 20,
    positionY: -1,
    receiveShadow: true,
  },
  postProcessing: {
    volumetricPassDepthBuffer: false,
    volumetricResolutionScale: 0.25,
    denoiseStrength: 0.6,
    volumetricLightingIntensity: 1,
  },
  /**
   * OrbitControls в Workflow: лимиты зума (отдаление), чтобы не вынимать камеру за volumetric-бокс.
   * Цель орбиты — начало координат, как у исходной сцены.
   */
  orbitControls: {
    minDistance: 11,
    maxDistance: 22,
  },
}

/**
 * Shallow-deep merge поверх `WORKFLOW_VOLUMETRIC_SETTINGS` для `isWorkflowMobileProfile()`.
 * Массивы из этого объекта полностью заменяют базовые (например `grainSamples`).
 */
export const WORKFLOW_VOLUMETRIC_MOBILE_OVERRIDES = {
  renderer: {
    antialias: true,
    maxPixelRatio: 1,
    /** Нельзя отключать: иначе у Point/Spot не создаётся shadowNode, volumetric обнуляется (см. VolumetricLightingModel.direct). */
    shadowMapEnabled: true,
    shadowMapType: 'basic',
  },
  noiseTexture3D: {
    size: 64,
  },
  volume: {
    /** Больше, чем на десктопе: при малых шагах march и сильном blur слабый smokeAmount даёт нулевую картинку. */
    rayMarchSteps: 8,
    smokeAmount: 0,
    grainSamples: [
      { scale: 0.1, timeScale: 1 },
      { scale: 0.05, timeScale: 1 },
      { scale: 0.02, timeScale: 2 },
    ],
  },
  postProcessing: {
    volumetricResolutionScale: 0.22,
    denoiseStrength: 0.32,
    volumetricLightingIntensity: 1.35,
  },
}

/**
 * Шаблон одного текстового оверлея: каждый элемент `PROCESS_SECTION_SETTINGS.textOverlays`
 * поверх этого объекта делается shallow-merge (можно задать только `text` и тайминги).
 */
export const PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS = {
  enabled: true,
  text: '',
  fontSizePx: 17,
  fontFamily: "'Inter', system-ui, sans-serif",
  fontWeight: '500',
  color: 'rgba(236, 242, 250, 0.94)',
  lineHeight: 1.4,
  letterSpacing: '0.01em',
  /**
   * Полоса по высоте секции, 0 = верх, 100 = низ. Удобные значения: 0, 25, 50, 75, 100.
   * Если задано число (или только `xSide`) — используется режим «квартиль + лево/право»;
   * тогда `placement` / `corner` не используются.
   */
  yPercent: null,
  /**
   * Полоса по ширине секции, 0 = левый край, 100 = правый.
   * Удобные значения: 0, 25, 50, 75, 100.
   */
  xPercent: null,
  /** `left` | `right` — к какому горизонтальному краю прижать блок (с отступом `insetPx`). */
  xSide: null,
  /**
   * Какую точку текста привязать к линии `yPercent`: `top` | `center` | `bottom`.
   * `null` — по `yPercent` подбирается автоматически (0/25 → верх блока, 50 → центр, 75/100 → низ).
   */
  yOrigin: null,
  /**
   * Какую точку текста привязать к линии `xPercent`: `left` | `center` | `right`.
   * `null` — авто по ближайшей четверти (0/25 → left, 50 → center, 75/100 → right).
   */
  xOrigin: null,
  /** `corner` — угол + `insetPx`; `center` — по центру кадра (если не задан режим yPercent/xSide). */
  placement: 'corner',
  /** `top-left` | `top-right` | `bottom-left` | `bottom-right` | устар. `center-left` / `center-right`. */
  corner: 'bottom-left',
  /** Отступ от краёв секции (px). Для `placement: center` — паддинг вокруг блока. */
  insetPx: 28,
  maxWidthPx: 340,
  /** `left` | `right` | `center` */
  textAlign: 'left',
  /** Секунды после готовности сцены — старт fade-in. */
  showAfterSec: 1.2,
  fadeInSec: 0.65,
  /** Секунды после готовности сцены — старт fade-out (должно быть > show + fade-in). */
  hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
  fadeOutSec: 0.75,
}

/**
 * Секция «Process» (цепь кубиков в WebGPU). HMR: правки применяются без перезагрузки.
 *
 * `cubes[]` — по одному элементу на каждый кубик (порядок = сверху вниз).
 * `material` — параметры THREE.MeshStandardMaterial; неуказанные поля
 * подставляются из `defaultMaterial`.
 * `procedural` — опционально: пресет шума, `enabled`, `seed`, `uvRepeat`.
 */
export const PROCESS_SECTION_SETTINGS = {
  /**
   * IBL: виртуальная «комната» → PMREM → scene.environment (единственный свет в секции).
   */
  environment: {
    /** Размытие геометрии комнаты перед выпечкой (радианы). */
    roomBlurSigma: 0.04,
    /** Сила `scene.environmentIntensity` (нет точечных/направленных источников). */
    intensity: 0.02,
  },

  /**
   * Старт: плашки не связаны цепью — каждая сама подлетает к своему restY.
   * После посадки всех — пауза `chainRevealDelaySec`, затем появляется нить и включается цепь в физике.
   */
  introTrain: {
    enabled: true,
    /** Выключатель вылета: false — плашки сразу в rest-позициях (без стартовой анимации). */
    flyEnabled: true,
    /**
     * Доп. зазор ниже нижнего края кадра: верх первой в порядке подлёта стартует за экраном.
     */
    startBelowMargin: 1.2,
    /** Пустой кадр в начале (сек). */
    introBlankSeconds: 0.18,
    /** Длительность подлёта одной плашки до своей позиции (сек). */
    plateFlyDurationSec: 5.15,
    /** Задержка между стартом подлёта следующей плашки (сек), в порядке `flyOrder`. */
    staggerBetweenPlatesSec: 3.45,
    /** После посадки всех — пауза до появления нити и включения цепи (сек). */
    chainRevealDelaySec: 0.85,
    /** Ease-out подлёта одной плашки. */
    easePower: 1.75,
    /** `top-first` — сначала «1. …», затем ниже; `bottom-first` — снизу вверх. */
    flyOrder: 'top-first',
  },

  /**
   * Несколько HTML-текстов поверх canvas (`pointer-events: none`).
   * Каждый элемент — частичная настройка поверх `PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS`.
   * Тайминги от момента готовности сцены (canvas в DOM после `renderer.init`).
   * Опционально `id` (строка) — стабильный ключ для React.
   */
  /** Глобальный выключатель fade-анимаций для всех текстов оверлея. */
  fadeTransitions: true,
  textOverlays: [
    {
      id: 'hint-01',
      fontFamily: "'Museo Cyrl', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 22,
      text: 'Когда появляется вещь,',
      yPercent: 5,
      xPercent: 20,
      yOrigin: 'center',
      textAlign: 'center',
      showAfterSec: 3,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-02',
      fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 60,
      text: 'МЫ',
      yPercent: 16,
      xPercent: 7,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'left',
      showAfterSec: 4,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-03',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 40,
      text: 'Как\nеё\nутяжелить.',
      yPercent: 20.5,
      xPercent: 95,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'right',
      showAfterSec: 4.5,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },

    {
      id: 'hint-05',
      fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 30,
      color: '#d2d7dc',
      text: 'МЕТАЛЛ',
      yPercent: 38.5,
      xPercent: 96,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'center',
      showAfterSec: 8.5,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-06',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 30,
      text: 'в подмосковном лесу.',
      yPercent: 50,
      xPercent: 5,
      xSide: 'left',
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'left',
      showAfterSec: 9,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-07',
      fontFamily: "'Museo Cyrl', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 30,
      text: 'Металл',
      yPercent: 59,
      xPercent: 2,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'left',
      showAfterSec: 11.2,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    
    {
      id: 'hint-09',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 50,
      text: 'Вещь',
      yPercent: 80,
      xPercent: 2,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'right',
      showAfterSec: 14.2,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
  ],

  /**
   * Процедурные карты: map, roughnessMap, metalnessMap (локальные дефекты), normalMap.
   * У куба можно задать свой `cubes[n].procedural`; иначе — preset по индексу.
   * `enabled: false` — отключить процедурные карты (только сплошной material).
   */
  procedural: {
    enabled: false,
    presetsByIndex: ['copper', 'lead', 'aluminum', 'bronze'],
    uvRepeat: [2, 2],
  },

  defaultMaterial: {
    color: 0x888888,
    roughness: 0.55,
    metalness: 0.72,
    envMapIntensity: 0.52,
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: false,
    opacity: 1,
    wireframe: false,
    flatShading: false,
  },

  /**
   * Плоский текст + опционально подзаголовок (меньший кегль) и 3D-декор на лице.
   * `label.object3d`: `primitive` (встроенные имена) или `handler` (кастом через `registerPlateFigure` в
   * `src/utils/plateFigureHandlers.js`); несколько фигур — `figures: [...]` и опционально `defaults`.
   * `imageUrl` — картинка; `fbxUrl` — FBX; `gltfUrl` / `glbUrl` — glTF/GLB (WorkflowSection, файлы в `public/`).
   */
  defaultLabel: {
    enabled: true,
    /** Заголовок (основная строка) */
    fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
    fontWeight: '400',
    fontSizePx: 300,
    /** Подзаголовок — отдельный шрифт (свой stack / вес; @font-face в `index.css`) */
    subtitleFontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
    subtitleFontWeight: '400',
    /**
     * Кегль подзаголовка: `subtitleFontSizePx` (px) ИЛИ `subtitleSizeRatio` от итогового
     * размера заголовка после автоподжима.
     */
    subtitleSizeRatio: 0.9,
    subtitleGapPx: 14,
    /** Вертикальный центр блока текста на канвасе (0–1). Ниже — больше места для object3d снизу */
    textBlockAnchorY: 0.33,
    color: 0x121418,
    subtitleColor: 0x1a1f26,
    planeScale: 0.92,
    zOffset: 0.002,
    pixelsPerUnit: 180,
    maxCanvasSide: 2048,
    /**
     * Декор под текстом: `primitive`, `handler` / `figure`, или `figures: [{ handler, position, ... }]`.
     */
    object3d: {
      enabled: false,
      primitive: 'sphere',
      size: 1,
      /** Локальный Z ≈ половина глубины плашки + вынесение к камере (под текущий PLATE_SCALE). */
      position: [0, -0.624, 0.173],
      rotation: [0, 0, 0],
      metalness: 0.86,
      roughness: 0.38,
      /** FBX в `public/` (WorkflowSection). Масштаб: наибольший размер bbox = `size` (или `fbxFitSize`). */
      // fbxUrl: '/models/Arbol.fbx',
      // gltfUrl: '/models/LionKeystone.glb',
    },
  },

  /**
   * Материал каждого плитки (сверху вниз): медь, свинец, алюминий, бронза.
   * Цвет / roughness / metalness + IBL и процедурные карты (`procedural`).
   */
  cubes: [
    {
      label: {
        text: '1. Думаем',
        object3d: {
          enabled: true,
          imageUrl: '/images/think_guy.jpg',
          size: 1.8,
          position: [0, -0.612, 0.173],
        },
      },
      // Сдвинуто к алюминию: холодный светло-серый металл, как у 3-й плашки.
      procedural: { preset: 'aluminum', seed: 90421 },
      material: {
        color: 0xd2d7dc,
        roughness: 0.54,
        metalness: 0.76,
        envMapIntensity: 0.5,
      },
    },
    {
      label: {
        text: '2. Собираем ',
        object3d: {
          enabled: true,
          fbxUrl: '/models/Arbol.fbx',
          size: 1.2,
          position: [0, -0.612, 0.173],
          rotation: [0, 0, 0],
        },
      },
      // Сдвинуто к алюминию: сохраняем лёгкий холодный оттенок.
      procedural: { preset: 'aluminum', seed: 48291 },
      material: {
        color: 0xcfd5db,
        roughness: 0.54,
        metalness: 0.76,
        envMapIntensity: 0.5,
      },
    },
    {
      label: {
        text: '3. Плавим',
        object3d: {
          enabled: true,
          gltfUrl: '/models/LionKeystone.glb',
          size: 1,
          position: [0, -0.612, 0.173],
          rotation: [0, 0, 0],
        },
      },
      // Алюминий: светло-серый, средняя шероховатость (анод / шлифовка).
      procedural: { preset: 'aluminum', seed: 71004 },
      material: {
        color: 0xd8dce0,
        roughness: 0.54,
        metalness: 0.76,
        envMapIntensity: 0.5,
      },
    },
    {
      label: {
        text: '4. Утяжеляем ',
        object3d: { enabled: true, primitive: 'cylinder', size: 0.324, position: [0, -0.612, 0.173] },
      },
      // Сдвинуто к алюминию: светлый нейтральный металл.
      procedural: { preset: 'aluminum', seed: 33657 },
      material: {
        color: 0xd9dee3,
        roughness: 0.54,
        metalness: 0.76,
        envMapIntensity: 0.5,
      },
    },
  ],
}
