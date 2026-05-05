import * as THREE from 'three/webgpu'

const PROCESS_TEXT_HIDE_AFTER_SEC = 18

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
 * `volumetric` — объёмный свет (отдельный слой + посткомпозит), см. preset ниже.
 */
export const PROCESS_SECTION_SETTINGS = {
  /**
   * IBL: виртуальная «комната» → PMREM → scene.environment (единственный свет в секции).
   */
  environment: {
    /** Размытие геометрии комнаты перед выпечкой (радианы). */
    roomBlurSigma: 0.04,
    /** Сила `scene.environmentIntensity` (нет точечных/направленных источников). */
    intensity: 1,
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
      id: 'hint-drag',
      fontFamily: "'Museo Cyrl', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 25,
      text: 'Когда появляется вещь,',
      yPercent: 5,
      xPercent: 3,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'left',
      showAfterSec: 3,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
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
      id: 'hint-drag',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 45,
      text: 'Как \n её \n утяжелить.',
      yPercent: 20.5,
      xPercent: 97,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'right',
      showAfterSec: 4.5,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
      fontFamily: "'Museo Cyrl', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontStyle: 'italic',
      fontSizePx: 40,
      text: 'п\nо\nс\nл\nе',
      /** Межстрочный интервал для многострочного текста: px имеет приоритет над lineHeight. */
      lineHeightPx: 28,
      yPercent: 38.5, 
      xPercent: 15,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'center',
      showAfterSec: 7,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
      fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 40,
      text: 'МЕТАЛЛ',
      yPercent: 38.5,
      xPercent: 100,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'center',
      showAfterSec: 8.5,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 30,
      text: 'в подмосковном лесу.',
      yPercent: 50,
      xSide: 'left',
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'center',
      showAfterSec: 9,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
      fontFamily: "'Museo Cyrl', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 30,
      text: 'металл',
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
      id: 'hint-drag',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 140,
      text: ',',
      yPercent: 58,
      xPercent:90,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'right',
      showAfterSec: 12.7,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
    {
      id: 'hint-drag',
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
    {
      id: 'hint-drag',
      fontFamily: "'Kalissa', 'Inter', system-ui, sans-serif",
      fontWeight: '400',
      fontSizePx: 200,
      text: '.',
      yPercent: 75,
      xPercent: 91,
      yOrigin: 'center',
      maxWidthPx: 340,
      textAlign: 'right',
      showAfterSec: 15,
      fadeInSec: 0.65,
      hideAfterSec: PROCESS_TEXT_HIDE_AFTER_SEC,
      fadeOutSec: 0.75,
    },
  ],

  /**
   * Объёмный свет (как в VolumetricLightingSection): большой raymarch-бокс + spot,
   * композит поверх основного прохода. Не освещает металл напрямую — только слой тумана.
   */
  volumetric: {
    enabled: true,
    layerIndex: 11,
    noiseTexture3D: {
      size: 96,
      perlinScale: 10,
      repeatFactor: 5,
      format: THREE.RedFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      unpackAlignment: 1,
    },
    volume: {
      rayMarchSteps: 14,
      smokeAmount: 1.35,
      timeScroll: { x: 0.8, y: 0, z: 0.25 },
      grainSamples: [
        { scale: 0.08, timeScale: 1 },
        { scale: 0.04, timeScale: 1 },
        { scale: 0.018, timeScale: 2 },
      ],
    },
    /** Коробка объёма вокруг колонки плашек (широкий конус spot её заполняет). */
    volumetricBox: {
      width: 42,
      height: 32,
      depth: 28,
      positionY: 0,
      receiveShadow: false,
    },
    spotLight: {
      color: 0xffffff,
      intensity: 140,
      angle: Math.PI / 2.2,
      penumbra: 0.55,
      decay: 2,
      distance: 0,
      castShadow: false,
      position: [14, 14, 22],
      target: [0, 0, 0],
    },
    /** Медленное вращение spot по горизонтали (рад/с, радиус, высота). */
    spotOrbit: {
      speed: 0.12,
      radius: 16,
      height: 14,
    },
    postProcessing: {
      volumetricPassName: 'Process volumetric',
      volumetricResolutionScale: 0.35,
      volumetricPassDepthBuffer: false,
      denoiseStrength: 0.55,
      volumetricLightingIntensity: 0.95,
    },
    rendererToneMapping: {
      toneMappingExposure: 1.35,
    },
  },

  /**
   * Процедурные карты: map, roughnessMap, metalnessMap (локальные дефекты), normalMap.
   * У куба можно задать свой `cubes[n].procedural`; иначе — preset по индексу.
   * `enabled: false` — отключить процедурные карты (только сплошной material).
   */
  procedural: {
    enabled: true,
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
   * `label.object3d`: примитив (`primitive`) или позже `gltfUrl` (подгрузка асинхронно).
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
    /** Декор под текстом: примитив или `gltfUrl` (не одновременно с primitive в одной плашке) */
    object3d: {
      enabled: false,
      primitive: 'sphere',
      size: 0.336,
      /** Локальный Z ≈ половина глубины плашки + вынесение к камере (под текущий PLATE_SCALE). */
      position: [0, -0.624, 0.173],
      rotation: [0, 0, 0],
      metalness: 0.86,
      roughness: 0.38,
      /** Пример внешней модели: положите .glb в `public/` и укажите путь */
      // gltfUrl: '/models/deco.glb',
      // gltfScale: 1,
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
        object3d: { enabled: true, primitive: 'icosahedron', size: 0.324, position: [0, -0.612, 0.173] },
      },
      // Медь: тёплый красноватый отлив, относительно гладкая полированная поверхность.
      procedural: { preset: 'copper', seed: 90421 },
      material: {
        color: 0xb87333,
        roughness: 0.46,
        metalness: 0.82,
        envMapIntensity: 0.48,
      },
    },
    {
      label: {
          text: '2. Собираем ',
        object3d: { enabled: true, primitive: 'box', size: 0.3, position: [0, -0.612, 0.173] },
      },
      // Свинец: холодный сине-серый, очень матовый «тяжёлый» металл.
      procedural: { preset: 'lead', seed: 48291 },
      material: {
        color: 0x6b6f78,
        roughness: 0.93,
        metalness: 0.48,
        envMapIntensity: 0.42,
      },
    },
    {
      label: {
        text: '3. Плавим',
        object3d: { enabled: true, primitive: 'torusKnot', size: 0.324, position: [0, -0.612, 0.173] },
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
      // Бронза: золотисто-коричневый сплав, чуть шероховатая литая поверхность.
      procedural: { preset: 'bronze', seed: 33657 },
      material: {
        color: 0x8d6e46,
        roughness: 0.58,
        metalness: 0.7,
        envMapIntensity: 0.46,
      },
    },
  ],
}
