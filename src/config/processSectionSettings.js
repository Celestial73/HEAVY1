import * as THREE from 'three/webgpu'

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
      size: 0.42,
      /** Локальный Z ≈ половина глубины плашки (0.375/2) + вынесение к камере */
      position: [0, -0.78, 0.216],
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
        subtitle: 'как утяжелить',
        object3d: { enabled: true, primitive: 'icosahedron', size: 0.4, position: [0, -0.76, 0.216] },
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
          text: '2. Собираем металл',
        subtitle: 'В подмосковном лесу',
        object3d: { enabled: true, primitive: 'box', size: 0.38, position: [0, -0.76, 0.216] },
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
        text: '3. Плавим металл',
        subtitle: 'В печке ',
        object3d: { enabled: true, primitive: 'torusKnot', size: 0.4, position: [0, -0.77, 0.216] },
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
        text: '4. Утяжеляем предмет',
        subtitle: 'и всё предмет тяжелый',
        object3d: { enabled: true, primitive: 'cylinder', size: 0.4, position: [0, -0.76, 0.216] },
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
