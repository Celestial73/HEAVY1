import * as THREE from 'three/webgpu'

/**
 * Все настройки volumetric-сцены (WebGPU). Редактируйте здесь.
 */
export const VOLUMETRIC_LIGHTING_SETTINGS = {
  /** Слой только для volumetric-pass (как в примере three.js). */
  layerIndex: 10,

  layout: {
    sectionClassName: 'relative h-svh w-full overflow-hidden bg-black',
    /**
     * 'pan-y' — на тачскринах вертикальный скролл уходит странице,
     * а горизонтальный жест может вращать сцену.
     * Поставь 'none', если нужен полноценный orbit на мобилке.
     */
    touchAction: 'pan-y',
  },

  renderer: {
    antialias: true,
    /** Верхняя граница DPR (меньше — быстрее на Retina). */
    maxPixelRatio: 2,
    toneMapping: THREE.NeutralToneMapping,
    toneMappingExposure: 2,
    shadowMapEnabled: true,
    shadowMapType: THREE.PCFShadowMap,
  },

  camera: {
    fov: 60,
    near: 0.1,
    far: 100,
    position: [-8, 1, -6],
  },

  orbitControls: {
    minDistance: 2,
    maxDistance: 40,
    /** Вращение сцены мышью. */
    enableRotate: false,
    /** Зум колесом — выключен, чтобы скролл уходил странице. */
    enableZoom: false,
    /** Перетаскивание правой кнопкой/двумя пальцами. */
    enablePan: false,
  },

  /** 3D-текстура шума для scattering (Perlin). */
  noiseTexture3D: {
    size: 128,
    perlinScale: 10,
    repeatFactor: 5,
    format: THREE.RedFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    unpackAlignment: 1,
  },

  /** Объём: шаги raymarch, дым, дрейф во времени. */
  volume: {
    rayMarchSteps: 12,
    /** Начальное значение uniform `smokeAmount`. */
    smokeAmount: 2,
    /**
     * Эквивалент vec3(time * x, y, time * z) для сдвига сэмпла.
     * Оригинал примера: time по X, 0 по Y, 0.3*time по Z.
     */
    timeScroll: { x: 1, y: 0, z: 0.3 },
    /**
     * Пары { scale, timeScale } для sampleGrain — порядок как в примере three.js.
     */
    grainSamples: [
      { scale: 0.1, timeScale: 1 },
      { scale: 0.05, timeScale: 1 },
      { scale: 0.02, timeScale: 2 },
    ],
  },

  /** Коробка-объём (mesh с VolumeNodeMaterial). */
  volumetricBox: {
    width: 20,
    height: 10,
    depth: 20,
    positionY: 2,
    receiveShadow: true,
  },

  /**
   * Расстановка предметов при загрузке.
   *
   * Камера стоит в (-8, 1, -6) и смотрит в (0, 0, 0). Освещены ближайшие
   * к началу координат точки (point light орбитит вокруг 0,1.4,0 в радиусе ~2.4,
   * spot light светит из (2.5,5,2.5) вниз). Поэтому область задана компактно:
   * предметы оказываются в кадре И в зоне света.
   */
  placement: {
    /** Случайно расставлять при загрузке. false — использовать заданные position. */
    random: true,
    /** Зона размещения по горизонтали (X/Z) — куб ~4×4 вокруг центра сцены. */
    area: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
    /**
     * Высота: предметы всегда висят в воздухе и в кадре.
     * Пол на y = floor.positionY (-3), volumetric box до y ≈ 7.
     */
    minY: -2,
    maxY: 3,
    /** Минимальная 3D-дистанция между предметами (старается, не гарантирует). */
    minDistance: 1.6,
    /** Случайная начальная ориентация. */
    randomizeRotation: true,
    /** Случайный масштаб каждого предмета (0.5 — мелкий, 1 — исходный). */
    randomScale: false,
    scaleMin: 0.5,
    scaleMax: 1,
  },

  /**
   * Лёгкая собственная физика: предметы медленно дрейфуют, падают
   * под слабой гравитацией и сталкиваются с полом.
   */
  physics: {
    enabled: true,
    /** Гравитация по Y (м/с²). 0 — невесомость, предметы просто дрейфуют. */
    gravity: 0,
    /**
     * Стартовая линейная скорость (м/с). Каждому предмету выбирается
     * случайное значение из диапазона [min, max] — все небольшие, но разные.
     */
    initialSpeedMin: 0.15,
    initialSpeedMax: 0.55,
    /** Доля от initialSpeed, которая уходит в Y (вверх/вниз). 0 — только горизонталь. */
    initialUpwardJitter: 0.4,
    /**
     * Сопротивление воздуха: множитель скорости в секунду.
     * 1 — нет, 0 — мгновенный стоп. 0.5 ≈ полная остановка за ~3–4 сек.
     */
    airDamping: 0.5,
    /** Коэффициент отскока от пола (0 — гасится полностью, 1 — упругий). */
    floorRestitution: 0.4,
    /** Трение по горизонтали при ударе об пол. */
    floorFriction: 0.7,
    /** Скорость ниже этого порога считается нулевой (м/с). */
    minLinearSpeed: 0.05,
    /** Дополнительный отступ от пола при коллизии (запас, чтобы тень не клипалась). */
    floorEpsilon: 0.005,
  },

  /**
   * Все интерактивные предметы сцены. По одному на пользовательский тычок.
   * Каждый предмет можно крутить независимо, на него нацелен raycast по нажатию.
   *
   * type: 'teapot' | 'box' | 'sphere' | 'icosahedron' | 'torus' | 'torusKnot' | 'cone' | 'cylinder'
   * args: параметры конструктора геометрии (см. switch в createSpinnableMesh).
   * material: опции MeshStandardMaterial (color, roughness, metalness, side: 'front'|'back'|'double').
   * sensitivity (опц.): { x, y, z } переопределяет interaction.dragSensitivity*.
   */
  spinnables: [
    {
      id: 'teapot',
      type: 'teapot',
      args: { size: 0.8, segments: 18 },
      position: [0, 0, 0],
      material: { color: 0xffffff, side: 'double' },
      castShadow: true,
    },
    {
      id: 'cube',
      type: 'box',
      args: { width: 0.7, height: 0.7, depth: 0.7 },
      position: [-2.6, -2.65, 1.4],
      material: { color: 0xff8b4d, roughness: 0.4, metalness: 0.2 },
      castShadow: true,
      sensitivity: { x: 0.012, y: 0.012, z: 0.006 },
    },
    {
      id: 'icosahedron',
      type: 'icosahedron',
      args: { radius: 0.55, detail: 0 },
      position: [2.4, -2.45, 0.6],
      material: { color: 0x53b5ff, roughness: 0.35, metalness: 0.5 },
      castShadow: true,
    },
    {
      id: 'torusKnot',
      type: 'torusKnot',
      args: { radius: 0.45, tube: 0.13, tubularSegments: 96, radialSegments: 12 },
      position: [-1, -2.4, -2.4],
      material: { color: 0xff64b7, roughness: 0.25, metalness: 0.4 },
      castShadow: true,
    },
  ],

  floor: {
    width: 100,
    height: 100,
    positionY: -3,
    color: 0xffffff,
    receiveShadow: true,
  },

  pointLight: {
    color: 0xffffff,
    intensity: 3,
    distance: 100,
    castShadow: true,
    initialPosition: [0, 1.4, 0],
  },

  spotLight: {
    color: 0xffffff,
    intensity: 100,
    angle: Math.PI / 6,
    penumbra: 1,
    decay: 2,
    distance: 0,
    castShadow: true,
    shadow: {
      intensity: 0.98,
      mapSize: 1024,
      cameraNear: 1,
      cameraFar: 15,
      focus: 1,
    },
    /** Базовая позиция; в анимации меняется X относительно orbitScale. */
    restPosition: [2.5, 5, 2.5],
  },

  /** Процедурная карта для spot (замена colors.png). */
  spotColorMap: {
    size: 256,
    gradient: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.45, color: '#ffffff' },
      { offset: 1, color: '#ffffff' },
    ],
  },

  /** Постобработка: второй pass + blur + интенсивность тумана. */
  postProcessing: {
    volumetricPassName: 'Volumetric Lighting',
    volumetricResolutionScale: 0.25,
    volumetricPassDepthBuffer: false,
    denoiseStrength: 0.6,
    volumetricLightingIntensity: 1,
  },

  /** Анимация источников. */
  animation: {
    orbitScale: 2.4,
    pointLight: {
      speedX: 0.7,
      speedY: 0.5,
      speedZ: 0.3,
      /**
       * Случайные фазы по каждой оси при загрузке: свет появляется в разной
       * точке своей орбиты, а не всегда в одной и той же.
       */
      randomizePhase: true,
    },
    spotLight: {
      /** Угловая скорость орбиты (rad/s в шкале сцены). */
      speed: 0.3,
      /** Радиус горизонтальной орбиты вокруг центра сцены. */
      radius: 3.5,
      /** Высота, на которой spot движется по кругу. */
      height: 5,
      /** Случайная стартовая фаза — каждый раз заходит с новой стороны. */
      randomizePhase: true,
    },
  },

  /** Связка "сцена оживает при касании". */
  motion: {
    /** Включить зависимость анимации сцены от вращения чайника. */
    drivenByInteraction: true,
    /** Множитель скорости в покое (0 — всё стоит). */
    idleSpeed: 0,
    /** Множитель скорости при активном вращении / инерции. */
    activeSpeed: 1,
    /** Угловая скорость чайника (rad/s), при которой множитель достигает 1. */
    activityThreshold: 1.5,
    /**
     * Инертность множителя скорости (сек): сколько лампам нужно, чтобы догнать целевую скорость.
     * Больше — медленнее разгоняются, дольше тормозят.
     */
    rampUpTime: 1.6,
    rampDownTime: 2.4,
  },

  /** Жесты по объекту (касание/мышь). */
  interaction: {
    /** Включает вращение чайника пальцем/мышью с инерцией. */
    enableDragRotate: true,
    /** Радиан на пиксель: вертикальный жест → наклон вперёд/назад (вокруг локальной оси X). */
    dragSensitivityX: 0.01,
    /** Радиан на пиксель: горизонтальный жест → разворот (вокруг локальной оси Y). */
    dragSensitivityY: 0.01,
    /** Радиан на пиксель (по сумме dx+dy): крен при диагональном жесте (вокруг локальной оси Z). */
    dragSensitivityZ: 0.005,
    /**
     * Сколько секунд предмет «раскручивается» до целевой скорости при удержании.
     * Больше — тяжелее и инертнее. 0 — мгновенно.
     */
    accelerationTime: 1.6,
    /** Сколько секунд предмет тормозит после отпускания. */
    decelerationTime: 2.6,
    /** Скорость ниже этого порога считается нулевой (rad/s). */
    minAngularVelocity: 0.0005,
  },

  /** 2D-оверлей поверх volumetric-сцены (текст, UI). */
  overlay: {
    /** Анимация появления бренд-заголовка построчно. */
    brandIntro: {
      /** Задержка перед началом первой строки (сек). */
      initialDelay: 2,
      /** Промежуток между соседними строками (сек). */
      lineStagger: 0.3,
    },
    /** Анимация появления кнопок управления (refresh, next). */
    controlsIntro: {
      /** Задержка перед появлением первой кнопки (сек). Должна быть больше brandIntro. */
      initialDelay: 4,
      /** Промежуток между соседними кнопками (сек). */
      stagger: 0.2,
    },
  },
}
