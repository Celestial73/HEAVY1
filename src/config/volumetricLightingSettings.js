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

  teapot: {
    size: 0.8,
    segments: 18,
    color: 0xffffff,
    side: THREE.DoubleSide,
    castShadow: true,
  },

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

  /** Анимация источников и чайника. */
  animation: {
    orbitScale: 2.4,
    pointLight: {
      speedX: 0.7,
      speedY: 0.5,
      speedZ: 0.3,
    },
    spotLight: {
      speedX: 0.3,
    },
    teapotRotationY: 0,
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
}
