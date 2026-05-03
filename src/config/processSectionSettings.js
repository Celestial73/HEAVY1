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
   * IBL: виртуальная «комната» → PMREM → scene.environment.
   * Усиливает правдоподобные отражения на металле (WebGPU).
   */
  environment: {
    /** Размытие геометрии комнаты перед выпечкой (радианы). */
    roomBlurSigma: 0.04,
    /** Вклад окружения — ниже → слабее зеркальность от IBL. */
    intensity: 0.58,
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
   * Материал каждого плитки (сверху вниз): медь, свинец, алюминий, бронза.
   * Цвет / roughness / metalness + IBL и процедурные карты (`procedural`).
   */
  cubes: [
    {
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
