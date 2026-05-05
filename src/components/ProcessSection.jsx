import { useEffect, useRef, useState } from 'react'
import ProcessSectionTextOverlay from './ProcessSectionTextOverlay.jsx'
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createMetalProceduralMaps } from '../utils/metalProceduralTextures.js'
import {
  PROCESS_SECTION_SETTINGS as defaults,
  PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS,
} from '../config/processSectionSettings.js'

function mergeMaterialOptions(defaultsObj, userObj = {}) {
  const out = { ...defaultsObj }
  for (const [k, v] of Object.entries(userObj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function mergeProcessLabel(defaultLabel, cubeLabel) {
  const a = defaultLabel ?? {}
  const b = cubeLabel ?? {}
  const object3d = {
    ...(a.object3d ?? {}),
    ...(b.object3d ?? {}),
  }
  if (b.object3d?.fbxUrl || b.object3d?.gltfUrl || b.object3d?.imageUrl) {
    delete object3d.primitive
  }
  return {
    ...a,
    ...b,
    object3d,
  }
}

/** Семейства из CSS font stack (фрагменты в '…' или "…") — для `document.fonts.load`. */
function extractQuotedFontFamilies(cssStack) {
  if (!cssStack || typeof cssStack !== 'string') return []
  const out = []
  const re = /'([^']+)'|"([^"]+)"/g
  let m
  while ((m = re.exec(cssStack)) !== null) {
    const name = (m[1] || m[2]).trim()
    if (name) out.push(name)
  }
  return [...new Set(out)]
}

/**
 * Canvas рисует до готовности @font-face → без `fonts.load` виден системный fallback.
 */
async function loadProcessLabelFonts(settings) {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  try {
    await document.fonts.ready
  } catch (_) {
    /* ignore */
  }

  const dl = settings.defaultLabel ?? {}
  const families = new Set()
  const addFrom = (stack) => {
    for (const f of extractQuotedFontFamilies(stack)) families.add(f)
  }
  addFrom(dl.fontFamily)
  addFrom(dl.subtitleFontFamily)

  for (const cube of settings.cubes ?? []) {
    const lb = cube.label ?? {}
    if (lb.fontFamily != null) addFrom(lb.fontFamily)
    if (lb.subtitleFontFamily != null) addFrom(lb.subtitleFontFamily)
  }

  const mainW = String(dl.fontWeight ?? '400').trim() || '400'
  const subW = String(dl.subtitleFontWeight ?? dl.fontWeight ?? '400').trim() || '400'
  const pxMain = 360
  const pxSub = Math.round(pxMain * 0.42)

  const loads = []
  const sampleText = 'Думаем Собираем Плавим Утяжеляем ABCDEFG'
  for (const fam of families) {
    loads.push(document.fonts.load(`${mainW} ${pxMain}px '${fam}'`, sampleText).catch(() => {}))
    loads.push(document.fonts.load(`${subW} ${pxSub}px '${fam}'`, sampleText).catch(() => {}))
  }
  await Promise.all(loads)
}

/**
 * Линейный масштаб плашки (1 = база 4.5×3.3×0.375).
 * `(2/3)*1.2` — на 1.2× крупнее, чем предыдущий пресет `2/3`.
 * Цепь и коллайдеры считаются от итоговых CUBE_* / CUBE_GAP.
 */
const PLATE_SCALE = (2 / 3) * 1.2
const CUBE_WIDTH = 4.5 * PLATE_SCALE
const CUBE_HEIGHT = 3.3 * PLATE_SCALE
const CUBE_DEPTH = 0.375 * PLATE_SCALE
/** Полоса рамки (от края плашки к центру) и выступ вперёд (+Z, к камере). */
const FRAME_RAIL = 0.15 * PLATE_SCALE
const FRAME_OUTSET = 0.075 * PLATE_SCALE
/** Фаски RoundedBoxGeometry: радиус скругления рёбер (сегменты дуги). */
const PLATE_BEVEL_RADIUS = 0.063 * PLATE_SCALE
const PLATE_BEVEL_SEGMENTS = 2
const FRAME_BEVEL_RADIUS = 0.021 * PLATE_SCALE
const FRAME_BEVEL_SEGMENTS = 1
/** Промежуток между соседними плитками (по Y, поверх их собственной высоты). */
const CUBE_GAP = 1.35 * PLATE_SCALE

/** Космос: сопротивления почти нет, но чтобы предметы не уезжали в бесконечность —
 *  лёгкое экспоненциальное затухание скорости (доля, остающаяся за секунду). */
const VELOCITY_DAMPING = 0.92

/**
 * Лёгкое покачивание кубиков (idle wobble). Каждая ось анимируется как
 *   angle = MAX_WOBBLE_TILT_RAD * sin(time * speed + phase)
 * → максимум отклонения по оси ровно WOBBLE_TILT_DEG градусов в обе стороны.
 *
 * У каждого кубика свои случайные скорости и фазы, поэтому колонка не
 * выглядит «синхронным механизмом». Скорости ограничены, чтобы движение
 * читалось как «парение в невесомости», а не как тряска.
 */
const WOBBLE_TILT_DEG = 10
const MAX_WOBBLE_TILT_RAD = (WOBBLE_TILT_DEG * Math.PI) / 180
const WOBBLE_SPEED_MIN = 0.25
const WOBBLE_SPEED_MAX = 0.6

function applyPlateWobble(cubes, elapsedTime) {
  for (const cube of cubes) {
    const w = cube.userData.wobble
    if (!w) continue
    cube.rotation.x = MAX_WOBBLE_TILT_RAD * Math.sin(elapsedTime * w.speedX + w.phaseX)
    cube.rotation.y = MAX_WOBBLE_TILT_RAD * Math.sin(elapsedTime * w.speedY + w.phaseY)
    cube.rotation.z = MAX_WOBBLE_TILT_RAD * Math.sin(elapsedTime * w.speedZ + w.phaseZ)
  }
}

/**
 * Инертный drag: кубик «догоняет» курсор пружиной, а не телепортируется.
 *  - DRAG_STIFFNESS — жёсткость пружины (1/с²). Больше → быстрее догоняет.
 *  - DRAG_DAMPING_RATIO — коэффициент демпфирования: 1 = критическое (без
 *    переколебаний), <1 — лёгкие колебания вокруг курсора, >1 — переторможено.
 *
 * Время «выхода на курсор» при критическом демпфировании ≈ 5 / sqrt(STIFFNESS) сек.
 * При STIFFNESS=25 это ~1с — ощущение «ленивого» догоняющего движения.
 */
const DRAG_STIFFNESS = 25
const DRAG_DAMPING_RATIO = 1

/**
 * Цепочка между соседними кубиками — однонаправленный constraint:
 *   |pos[i] − pos[i+1]| ≤ CHAIN_LENGTH
 *
 * Пока расстояние меньше — звено провисает, кубики двигаются независимо.
 * Когда натянулась — кубик-сосед подтягивается к тому, что мы тянем.
 *
 *  - CHAIN_LENGTH должна быть > шага колонны (CUBE_HEIGHT + CUBE_GAP), с запасом.
 *  - CONSTRAINT_ITERATIONS — сколько раз за кадр прогоняем все звенья и
 *    столкновения. Больше итераций = стабильнее распространение через
 *    несколько звеньев и устойчивее разрешение коллизий стопками. 8
 *    хватает для 4 кубиков.
 */
const COMBAT_STRIDE = CUBE_HEIGHT + CUBE_GAP
const CHAIN_LENGTH = COMBAT_STRIDE * 1.22
const CONSTRAINT_ITERATIONS = 8

/**
 * Столкновения между кубиками. Используем AABB-проекцию (не учитываем
 * 10° wobble — он почти не виден на пересечениях). При перекрытии
 * раздвигаем по оси минимальной пенетрации; веса — как в цепи:
 * удерживаемый неподвижен (вес 0), свободные делят 50/50.
 *
 *  - COLLIDER_PADDING — дополнительный зазор между плитками сверх их
 *    геометрии. 0 = соприкасаются плотно, >0 — небольшой воздушный зазор.
 */
const COLLIDER_PADDING = 0.03 * PLATE_SCALE

/**
 * Мягкая граница экрана. Кубик не улетает за края, но и не «прилипает»:
 *  - на стене теряется почти вся скорость (через position-clamp),
 *  - оставшаяся составляющая отражается с коэффициентом возврата → лёгкий
 *    откат от границы небольшой скоростью.
 *
 *  - BOUNCE_RESTITUTION = 0.15 → ~85% энергии гасится, остаётся слабый rebound.
 *    Поставь 0 — кубик «прилипает» к границе. 1 — упругий мячик.
 *  - BOUNCE_TANGENT_FRICTION = 0.9 → тангенциальная скорость вдоль стены
 *    теряет 10% при ударе (имитация трения).
 */
const BOUNCE_RESTITUTION = 0.15
const BOUNCE_TANGENT_FRICTION = 0.9

function measureLineHeight(ctx, text, fontPx, weight, family) {
  ctx.font = `${weight} ${fontPx}px ${family}`
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent ?? fontPx * 0.72
  const desc = m.actualBoundingBoxDescent ?? fontPx * 0.28
  return asc + desc
}

/**
 * Плоский текст на лицевой стороне: canvas → CanvasTexture на PlaneGeometry.
 * Опционально вторая строка `subtitle` — меньший кегль; шрифт задаётся отдельно:
 * `subtitleFontFamily`, `subtitleFontWeight`, `subtitleFontSizePx` / `subtitleSizeRatio`.
 */
function createFlatLabelPlane(plateMat, mergedLabel) {
  const textStr = mergedLabel?.text != null ? String(mergedLabel.text).trim() : ''
  if (mergedLabel?.enabled === false || textStr.length === 0) return null

  const innerW = CUBE_WIDTH - 2 * FRAME_RAIL
  const innerH = Math.max(0.02, CUBE_HEIGHT - 2 * FRAME_RAIL)
  const planeScale = mergedLabel.planeScale ?? 0.92
  const planeW = innerW * planeScale
  const planeH = innerH * planeScale

  const fontFamily = mergedLabel.fontFamily ?? 'system-ui, sans-serif'
  const fontWeight = mergedLabel.fontWeight ?? '600'
  let fontSizePx = mergedLabel.fontSizePx ?? 160

  const subStrRaw = mergedLabel.subtitle != null ? String(mergedLabel.subtitle).trim() : ''
  const subFamily = mergedLabel.subtitleFontFamily ?? fontFamily
  const subWeight = mergedLabel.subtitleFontWeight ?? fontWeight

  const pixelsPerUnit = mergedLabel.pixelsPerUnit ?? 180
  const maxCanvasSide = mergedLabel.maxCanvasSide ?? 2048
  const cw = Math.min(
    maxCanvasSide,
    Math.max(256, Math.round(planeW * pixelsPerUnit)),
  )
  const ch = Math.max(64, Math.round(cw * (planeH / planeW)))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, cw, ch)

  const colorNum = mergedLabel.color !== undefined ? mergedLabel.color : 0x121418
  const hex = `#${(colorNum >>> 0).toString(16).padStart(6, '0')}`
  const subColorNum =
    mergedLabel.subtitleColor !== undefined ? mergedLabel.subtitleColor : colorNum
  const subHex = `#${(subColorNum >>> 0).toString(16).padStart(6, '0')}`

  const setMainFont = (px) => {
    ctx.font = `${fontWeight} ${px}px ${fontFamily}`
  }
  const setSubFont = (px) => {
    ctx.font = `${subWeight} ${px}px ${subFamily}`
  }

  setMainFont(fontSizePx)
  while (ctx.measureText(textStr).width > cw * 0.92 && fontSizePx > 12) {
    fontSizePx -= 3
    setMainFont(fontSizePx)
  }

  let subFontSizePx = 12
  if (subStrRaw) {
    subFontSizePx =
      mergedLabel.subtitleFontSizePx ??
      Math.round(fontSizePx * (mergedLabel.subtitleSizeRatio ?? 0.38))
  }

  let mainH = measureLineHeight(ctx, textStr, fontSizePx, fontWeight, fontFamily)
  let subH = 0
  if (subStrRaw) {
    setSubFont(subFontSizePx)
    while (ctx.measureText(subStrRaw).width > cw * 0.92 && subFontSizePx > 10) {
      subFontSizePx -= 2
      setSubFont(subFontSizePx)
    }
    subH = measureLineHeight(ctx, subStrRaw, subFontSizePx, subWeight, subFamily)
  }

  const gap = mergedLabel.subtitleGapPx ?? 12
  const blockCenterY = ch * (mergedLabel.textBlockAnchorY ?? (subStrRaw ? 0.36 : 0.5))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (!subStrRaw) {
    ctx.fillStyle = hex
    setMainFont(fontSizePx)
    ctx.fillText(textStr, cw / 2, blockCenterY)
  } else {
    const totalH = mainH + gap + subH
    const mainY = blockCenterY - totalH / 2 + mainH / 2
    const subY = mainY + mainH / 2 + gap + subH / 2
    ctx.fillStyle = hex
    setMainFont(fontSizePx)
    ctx.fillText(textStr, cw / 2, mainY)
    ctx.fillStyle = subHex
    setSubFont(subFontSizePx)
    ctx.fillText(subStrRaw, cw / 2, subY)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true

  const geom = new THREE.PlaneGeometry(planeW, planeH)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    metalness: 0.2,
    roughness: 0.55,
    envMapIntensity: Math.min(1.5, (plateMat.envMapIntensity ?? 0.5) * 0.9),
    side: THREE.FrontSide,
  })

  const mesh = new THREE.Mesh(geom, mat)
  mesh.renderOrder = 1
  mesh.position.z = CUBE_DEPTH * 0.5 + (mergedLabel.zOffset ?? 0.002 * PLATE_SCALE)
  return mesh
}

/**
 * Примитив на лицевой стороне (ниже текста; позиция в локали плашки).
 * Для `gltfUrl` меш подгружается отдельно (см. useEffect), здесь не создаётся.
 */
function createPlateObject3d(plateMat, mergedLabel) {
  const od = mergedLabel.object3d
  if (!od || od.enabled === false || od.gltfUrl) return null

  const primitive = od.primitive ?? 'sphere'
  const size = od.size ?? 0.44 * PLATE_SCALE
  let geom
  switch (primitive) {
    case 'box':
      geom = new THREE.BoxGeometry(size, size, size * 0.75)
      break
    case 'torusKnot':
      geom = new THREE.TorusKnotGeometry(size * 0.32, size * 0.11, 48, 12)
      break
    case 'icosahedron':
      geom = new THREE.IcosahedronGeometry(size * 0.5, 0)
      break
    case 'cone':
      geom = new THREE.ConeGeometry(size * 0.45, size * 0.88, 32)
      break
    case 'cylinder':
      geom = new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 0.85, 32)
      break
    case 'torus':
      geom = new THREE.TorusGeometry(size * 0.38, size * 0.1, 24, 32)
      break
    case 'sphere':
    default:
      geom = new THREE.SphereGeometry(size * 0.5, 32, 24)
  }

  const mat = plateMat.clone()
  mat.map = null
  mat.normalMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.normalScale = new THREE.Vector2(1, 1)
  if (od.color !== undefined) {
    mat.color.setHex(od.color)
  } else {
    mat.color.multiplyScalar(1.04)
  }
  mat.metalness = od.metalness ?? 0.85
  mat.roughness = od.roughness ?? 0.4
  const mesh = new THREE.Mesh(geom, mat)
  const p = od.position ?? [0, -0.78 * PLATE_SCALE, CUBE_DEPTH * 0.5 + 0.028 * PLATE_SCALE]
  const r = od.rotation ?? [0, 0, 0]
  mesh.position.set(p[0], p[1], p[2])
  mesh.rotation.set(r[0], r[1], r[2])
  mesh.renderOrder = 2
  return mesh
}

/** Группа: корпус плашки + лицевая рамка + опционально плоский текст (canvas). */
function buildPlateWithBezel(plateMat, mergedLabel) {
  const tile = new THREE.Group()
  tile.userData.isProcessTileRoot = true

  const plateGeom = new RoundedBoxGeometry(
    CUBE_WIDTH,
    CUBE_HEIGHT,
    CUBE_DEPTH,
    PLATE_BEVEL_SEGMENTS,
    PLATE_BEVEL_RADIUS,
  )
  const plate = new THREE.Mesh(plateGeom, plateMat)
  tile.add(plate)

  const frameMat = plateMat.clone()
  frameMat.color.multiplyScalar(0.4)
  frameMat.roughness = Math.min(1, (frameMat.roughness ?? 0.5) + 0.18)
  frameMat.metalness = Math.min(1, (frameMat.metalness ?? 0.8) + 0.05)

  const zc = CUBE_DEPTH * 0.5 + FRAME_OUTSET * 0.5
  const innerH = Math.max(0.02, CUBE_HEIGHT - 2 * FRAME_RAIL)

  const segments = [
    {
      geom: new RoundedBoxGeometry(
        CUBE_WIDTH,
        FRAME_RAIL,
        FRAME_OUTSET,
        FRAME_BEVEL_SEGMENTS,
        FRAME_BEVEL_RADIUS,
      ),
      pos: [0, CUBE_HEIGHT * 0.5 - FRAME_RAIL * 0.5, zc],
    },
    {
      geom: new RoundedBoxGeometry(
        CUBE_WIDTH,
        FRAME_RAIL,
        FRAME_OUTSET,
        FRAME_BEVEL_SEGMENTS,
        FRAME_BEVEL_RADIUS,
      ),
      pos: [0, -CUBE_HEIGHT * 0.5 + FRAME_RAIL * 0.5, zc],
    },
    {
      geom: new RoundedBoxGeometry(
        FRAME_RAIL,
        innerH,
        FRAME_OUTSET,
        FRAME_BEVEL_SEGMENTS,
        FRAME_BEVEL_RADIUS,
      ),
      pos: [-CUBE_WIDTH * 0.5 + FRAME_RAIL * 0.5, 0, zc],
    },
    {
      geom: new RoundedBoxGeometry(
        FRAME_RAIL,
        innerH,
        FRAME_OUTSET,
        FRAME_BEVEL_SEGMENTS,
        FRAME_BEVEL_RADIUS,
      ),
      pos: [CUBE_WIDTH * 0.5 - FRAME_RAIL * 0.5, 0, zc],
    },
  ]

  for (const { geom, pos } of segments) {
    const rail = new THREE.Mesh(geom, frameMat)
    rail.position.set(pos[0], pos[1], pos[2])
    tile.add(rail)
  }

  const labelMesh = createFlatLabelPlane(plateMat, mergedLabel)
  if (labelMesh) tile.add(labelMesh)
  const deco3d = createPlateObject3d(plateMat, mergedLabel)
  if (deco3d) tile.add(deco3d)

  return tile
}

function tileFromIntersectObject(obj) {
  let o = obj
  while (o) {
    if (o instanceof THREE.Group && o.userData?.isProcessTileRoot) return o
    o = o.parent
  }
  return null
}

function disposeTileResources(tile) {
  tile.userData.proceduralDispose?.()
  const materials = new Set()
  tile.traverse((ch) => {
    if (!ch.isMesh) return
    ch.geometry?.dispose()
    ch.material?.map?.dispose()
    const m = ch.material
    if (Array.isArray(m)) m.forEach((mm) => materials.add(mm))
    else if (m) materials.add(m)
  })
  materials.forEach((m) => m.dispose())
}

/** Смещение к камере (+local Z), чтобы нить не зарывалась в металл и не пропадала в depth. */
const CHAIN_FACE_Z_OUTSET = 0.09 * PLATE_SCALE

/** Только зазоры между плашками: нижнее переднее ребро верхней → верхнее переднее ребро нижней (без линий по поверхности). */
function fillChainGapSegments(cubes, positions, chainTop, chainBot) {
  const hh = CUBE_HEIGHT * 0.5
  const fz = CUBE_DEPTH * 0.5 + CHAIN_FACE_Z_OUTSET
  const n = cubes.length
  for (let i = 0; i < n - 1; i += 1) {
    const upper = cubes[i]
    const lower = cubes[i + 1]
    upper.updateMatrixWorld(true)
    lower.updateMatrixWorld(true)
    chainBot.set(0, -hh, fz).applyMatrix4(upper.matrixWorld)
    chainTop.set(0, hh, fz).applyMatrix4(lower.matrixWorld)
    const o = i * 6
    positions[o] = chainBot.x
    positions[o + 1] = chainBot.y
    positions[o + 2] = chainBot.z
    positions[o + 3] = chainTop.x
    positions[o + 4] = chainTop.y
    positions[o + 5] = chainTop.z
  }
}

export default function ProcessSection() {
  const containerRef = useRef(null)
  const [settings, setSettings] = useState(defaults)
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/processSectionSettings.js', (mod) => {
      if (mod?.PROCESS_SECTION_SETTINGS) setSettings(mod.PROCESS_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  useEffect(() => {
    setSceneReady(false)
    const container = containerRef.current
    if (!container) return undefined

    const cubeSpecs = settings.cubes
    const cubeCount = cubeSpecs.length
    if (cubeCount < 1) return undefined

    const introCfg = settings.introTrain ?? defaults.introTrain
    /** `fly` | `chain-wait` | `done` — до `done` цепь в физике и линия нити выключены (после таймера). */
    let introPhase = 'done'
    let introElapsed = 0
    let chainWaitElapsed = 0
    let chainPhysicsEnabled = true

    let renderer = null
    let resizeObserver = null
    let cancelled = false
    let environmentTarget = null

    let scene = null
    let camera = null
    const cubes = []
    const chainTop = new THREE.Vector3()
    const chainBot = new THREE.Vector3()
    let chainGeom = null
    let chainMat = null
    let chainLine = null
    let chainPositions = null
    let onResize = () => {}

    void (async () => {
      await loadProcessLabelFonts(settings)
      if (cancelled) return

      scene = new THREE.Scene()
      scene.background = null

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      camera.position.set(0, 0, 21)
      camera.lookAt(0, 0, 0)

      // Свет только из IBL (scene.environment ниже, после PMREM).
      // Кубики: вертикальная колонка по Y. Каждый — отдельный физический объект
      // с собственным velocity. Z = 0, drag живёт в плоскости z=0.
      const totalHeight = (cubeCount - 1) * COMBAT_STRIDE
      const topY = totalHeight / 2
      for (let i = 0; i < cubeCount; i += 1) {
        const spec = cubeSpecs[i] ?? {}
        const matOpts = mergeMaterialOptions(settings.defaultMaterial, spec.material ?? {})

        const globalProc = settings.procedural ?? {}
        const cubeProc = spec.procedural
        const procOn =
          globalProc.enabled !== false && (cubeProc === undefined || cubeProc.enabled !== false)
        let proceduralDispose = null
        if (procOn) {
          const presets = globalProc.presetsByIndex ?? [
            'copper',
            'lead',
            'aluminum',
            'bronze',
          ]
          const preset = (cubeProc && cubeProc.preset) ?? presets[i % presets.length] ?? 'copper'
          const seed = (cubeProc && typeof cubeProc.seed === 'number'
            ? cubeProc.seed
            : i * 7919 + 1337)
          const uv = globalProc.uvRepeat ?? [3.5, 3.5]
          const uvU = (cubeProc && cubeProc.uvRepeat && cubeProc.uvRepeat[0]) ?? uv[0]
          const uvV = (cubeProc && cubeProc.uvRepeat && cubeProc.uvRepeat[1]) ?? uv[1]
          const maps = createMetalProceduralMaps(preset, seed, {
            uvRepeatU: uvU,
            uvRepeatV: uvV,
          })
          Object.assign(matOpts, maps.textures)
          matOpts.normalScale = maps.normalScale
          proceduralDispose = maps.dispose
        }

        const mat = new THREE.MeshStandardMaterial(matOpts)
        const mergedLabel = mergeProcessLabel(settings.defaultLabel, spec.label)
        const tile = buildPlateWithBezel(mat, mergedLabel)
        tile.userData.proceduralDispose = proceduralDispose
        const restY = topY - i * COMBAT_STRIDE
        tile.userData.restY = restY
        tile.position.set(0, restY, 0)
        tile.userData.velocity = new THREE.Vector3(0, 0, 0)
        // Уникальные параметры покачивания: фазы — случайные [0, 2π],
        // скорости — случайные в диапазоне [WOBBLE_SPEED_MIN, WOBBLE_SPEED_MAX].
        const TAU = Math.PI * 2
        const randSpeed = () =>
          WOBBLE_SPEED_MIN + Math.random() * (WOBBLE_SPEED_MAX - WOBBLE_SPEED_MIN)
        tile.userData.wobble = {
          phaseX: Math.random() * TAU,
          phaseY: Math.random() * TAU,
          phaseZ: Math.random() * TAU,
          speedX: randSpeed(),
          speedY: randSpeed(),
          speedZ: randSpeed(),
        }
        scene.add(tile)
        cubes.push(tile)
      }

    const chainGapCount = Math.max(0, cubes.length - 1)

    chainPositions = chainGapCount > 0 ? new Float32Array(chainGapCount * 6) : null

    if (chainGapCount > 0 && chainPositions) {
      fillChainGapSegments(cubes, chainPositions, chainTop, chainBot)
      chainGeom = new THREE.BufferGeometry()
      chainGeom.setAttribute('position', new THREE.BufferAttribute(chainPositions, 3))
      chainMat = new THREE.LineBasicMaterial({
        color: 0xf2f6fc,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        depthTest: true,
      })
      chainLine = new THREE.LineSegments(chainGeom, chainMat)
      chainLine.renderOrder = 6
      scene.add(chainLine)
    }

    onResize = () => {
      if (!renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    ;(async () => {
      renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)

      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()

      try {
        await renderer.init()
      } catch (err) {
        console.error('WebGPU init failed:', err)
        return
      }
      if (cancelled) return

      const halfFovTanFrame = Math.tan(camera.fov * 0.5 * (Math.PI / 180))
      const halfCubeHFrame = CUBE_HEIGHT / 2
      const viewHFrame = 2 * Math.abs(camera.position.z) * halfFovTanFrame
      const minYFrame = -viewHFrame / 2 + halfCubeHFrame
      const bottomEdgeY = minYFrame - halfCubeHFrame
      const margin = introCfg?.startBelowMargin ?? 1.2

      const introFlyEnabled = introCfg?.enabled !== false && introCfg?.flyEnabled !== false
      if (introFlyEnabled && cubeCount > 0) {
        const flyOrder = introCfg?.flyOrder === 'bottom-first' ? 'bottom-first' : 'top-first'
        const order =
          flyOrder === 'bottom-first'
            ? [...Array(cubeCount).keys()].reverse()
            : [...Array(cubeCount).keys()]
        const stackTopY = cubes[0].userData.restY + halfCubeHFrame
        const drop = bottomEdgeY - margin - stackTopY
        for (const cube of cubes) {
          cube.position.y = cube.userData.restY + drop
          cube.position.x = 0
          cube.position.z = 0
          cube.userData.velocity.set(0, 0, 0)
        }
        const dIntro = defaults.introTrain ?? {}
        const blank = introCfg?.introBlankSeconds ?? dIntro.introBlankSeconds ?? 0.18
        const stagger = Math.max(0, introCfg?.staggerBetweenPlatesSec ?? dIntro.staggerBetweenPlatesSec ?? 0.4)
        const plateDur = Math.max(0.12, introCfg?.plateFlyDurationSec ?? dIntro.plateFlyDurationSec ?? 1.1)
        for (let seq = 0; seq < order.length; seq += 1) {
          const i = order[seq]
          const cube = cubes[i]
          const t0 = blank + seq * stagger
          const t1 = t0 + plateDur
          cube.userData.introFlyT0 = t0
          cube.userData.introFlyT1 = t1
          cube.userData.introFlyStartY = cube.position.y
        }
        introElapsed = 0
        chainWaitElapsed = 0
        introPhase = 'fly'
        chainPhysicsEnabled = false
        if (chainLine) chainLine.visible = false
      } else {
        for (const cube of cubes) {
          cube.position.set(0, cube.userData.restY, 0)
          cube.userData.velocity.set(0, 0, 0)
        }
        introPhase = 'done'
        chainPhysicsEnabled = true
        if (chainLine) chainLine.visible = true
      }

      void (async () => {
        const byUrl = new Map()
        for (let i = 0; i < cubeCount; i += 1) {
          const od = mergeProcessLabel(settings.defaultLabel, cubeSpecs[i]?.label ?? {}).object3d
          const url = od?.gltfUrl
          if (!url || od.enabled === false) continue
          if (!byUrl.has(url)) byUrl.set(url, [])
          byUrl.get(url).push({ index: i, od })
        }
        if (byUrl.size === 0) return undefined
        try {
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
          const loader = new GLTFLoader()
          for (const [url, items] of byUrl) {
            if (cancelled) return undefined
            const gltf = await loader.loadAsync(url)
            for (const { index, od } of items) {
              if (cancelled) return undefined
              const root = gltf.scene.clone(true)
              const s = od.gltfScale ?? 1
              root.scale.setScalar(s)
              const p = od.position ?? [0, -0.78 * PLATE_SCALE, CUBE_DEPTH * 0.5 + 0.028 * PLATE_SCALE]
              const r = od.rotation ?? [0, 0, 0]
              root.position.set(p[0], p[1], p[2])
              root.rotation.set(r[0], r[1], r[2])
              root.traverse((o) => {
                if (o.isMesh) o.renderOrder = 2
              })
              cubes[index].add(root)
            }
          }
        } catch (e) {
          console.warn('ProcessSection: label.object3d gltf failed', e)
        }
        return undefined
      })()

      const envCfg = settings.environment ?? {}
      const roomBlurSigma = envCfg.roomBlurSigma ?? 0.04
      const environmentIntensity = envCfg.intensity ?? 0.88

      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      const roomEnvironment = new RoomEnvironment()
      environmentTarget = pmremGenerator.fromScene(roomEnvironment, roomBlurSigma)
      scene.environment = environmentTarget.texture
      scene.environmentIntensity = environmentIntensity
      pmremGenerator.dispose()

      container.appendChild(renderer.domElement)
      renderer.domElement.style.touchAction = 'none'
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.cursor = 'default'
      renderer.domElement.style.pointerEvents = 'auto'
      if (!cancelled) setSceneReady(true)

      // Drag-интеракция: проекция курсора на плоскость, перпендикулярную
      // камере, проходящую через схваченный кубик. Так движение по X/Y
      // соответствует физическому смещению объекта в той же плоскости.
      const raycaster = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      const dragPlane = new THREE.Plane()
      const dragOffset = new THREE.Vector3()
      const intersection = new THREE.Vector3()
      let dragging = null

      const updateNdc = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        return true
      }

      const onPointerDown = (event) => {
        if (!updateNdc(event)) return
        raycaster.setFromCamera(ndc, camera)
        const hit = raycaster.intersectObjects(cubes, true)[0]
        if (!hit) return

        const mesh = tileFromIntersectObject(hit.object)
        if (!mesh) return
        finishIntroToGameplay()
        // Плоскость drag'а — параллельна экрану (нормаль = -forward камеры),
        // проходит через текущую позицию кубика. Гарантирует, что
        // во всех ракурсах drag двигает только в плоскости экрана.
        const normal = new THREE.Vector3()
        camera.getWorldDirection(normal)
        normal.negate()
        dragPlane.setFromNormalAndCoplanarPoint(normal, mesh.position)

        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
          dragOffset.copy(intersection).sub(mesh.position)
        } else {
          dragOffset.set(0, 0, 0)
        }

        // На захвате гасим унаследованную скорость, чтобы кубик начинал
        // догонять курсор «с нуля» (как в первой секции при rotate-drag'е).
        mesh.userData.velocity.set(0, 0, 0)
        dragging = {
          mesh,
          pointerId: event.pointerId,
          lockedZ: mesh.position.z,
          // Куда хочет «привести» кубик курсор. Реальная позиция меша
          // подтягивается к target через пружину в animation loop'е.
          target: mesh.position.clone(),
        }
        renderer.domElement.setPointerCapture?.(event.pointerId)
        renderer.domElement.style.cursor = 'grabbing'
      }

      const onPointerMove = (event) => {
        if (!dragging || dragging.pointerId !== event.pointerId) {
          if (!dragging && updateNdc(event)) {
            raycaster.setFromCamera(ndc, camera)
            const hoverHit = raycaster.intersectObjects(cubes, true)[0]
            const hover = hoverHit ? tileFromIntersectObject(hoverHit.object) : null
            renderer.domElement.style.cursor = hover ? 'grab' : 'default'
          }
          return
        }
        if (!updateNdc(event)) return

        raycaster.setFromCamera(ndc, camera)
        if (!raycaster.ray.intersectPlane(dragPlane, intersection)) return

        // Обновляем только цель — позицию и скорость считает физика.
        dragging.target.copy(intersection).sub(dragOffset)
        dragging.target.z = dragging.lockedZ
      }

      const releaseDrag = (event) => {
        if (!dragging || dragging.pointerId !== event.pointerId) return
        try {
          renderer.domElement.releasePointerCapture?.(event.pointerId)
        } catch {
          // pointer capture мог быть уже снят браузером — игнорируем.
        }
        dragging = null
        renderer.domElement.style.cursor = 'default'
      }

      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', releaseDrag)
      renderer.domElement.addEventListener('pointercancel', releaseDrag)
      renderer.domElement.addEventListener('pointerleave', releaseDrag)

      const clock = new THREE.Clock()
      // Параметры пружины предвычисляем: omega — собственная частота, c —
      // коэффициент демпфирования. Для критического случая c = 2·omega.
      const springOmega = Math.sqrt(DRAG_STIFFNESS)
      const springC = 2 * DRAG_DAMPING_RATIO * springOmega

      const chainMaxSq = CHAIN_LENGTH * CHAIN_LENGTH

      const halfCubeW = CUBE_WIDTH / 2
      const halfCubeH = CUBE_HEIGHT / 2

      const introFlyEasePow = introCfg?.easePower ?? defaults.introTrain?.easePower ?? 1.75
      const chainRevealDelaySec = Math.max(0, introCfg?.chainRevealDelaySec ?? 0.75)

      const finishIntroToGameplay = () => {
        if (introPhase === 'done') return
        introPhase = 'done'
        chainPhysicsEnabled = true
        chainWaitElapsed = 0
        if (chainLine) chainLine.visible = true
        for (const cube of cubes) {
          cube.position.set(0, cube.userData.restY, 0)
          cube.userData.velocity.set(0, 0, 0)
        }
      }

      const resolveChainAndCollisions = () => {
        const collW = halfCubeW + COLLIDER_PADDING
        const collH = halfCubeH + COLLIDER_PADDING

        for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter += 1) {
          if (chainPhysicsEnabled) {
            for (let i = 0; i < cubes.length - 1; i += 1) {
              const a = cubes[i]
              const b = cubes[i + 1]
              const dx = b.position.x - a.position.x
              const dy = b.position.y - a.position.y
              const distSq = dx * dx + dy * dy
              if (distSq <= chainMaxSq) continue

              const dist = Math.sqrt(distSq) || 1
              const overflow = dist - CHAIN_LENGTH
              const aHeld = dragging?.mesh === a
              const bHeld = dragging?.mesh === b

              let wA
              let wB
              if (aHeld && !bHeld) {
                wA = 0
                wB = 1
              } else if (bHeld && !aHeld) {
                wA = 1
                wB = 0
              } else {
                wA = 0.5
                wB = 0.5
              }

              const ux = dx / dist
              const uy = dy / dist
              a.position.x += ux * overflow * wA
              a.position.y += uy * overflow * wA
              b.position.x -= ux * overflow * wB
              b.position.y -= uy * overflow * wB
            }
          }

          for (let i = 0; i < cubes.length; i += 1) {
            for (let j = i + 1; j < cubes.length; j += 1) {
              const a = cubes[i]
              const b = cubes[j]

              const dx = b.position.x - a.position.x
              const dy = b.position.y - a.position.y
              const overlapX = 2 * collW - Math.abs(dx)
              const overlapY = 2 * collH - Math.abs(dy)
              if (overlapX <= 0 || overlapY <= 0) continue

              const aHeld = dragging?.mesh === a
              const bHeld = dragging?.mesh === b
              let wA
              let wB
              if (aHeld && !bHeld) {
                wA = 0
                wB = 1
              } else if (bHeld && !aHeld) {
                wA = 1
                wB = 0
              } else {
                wA = 0.5
                wB = 0.5
              }

              if (overlapX < overlapY) {
                const sign = dx === 0 ? 1 : Math.sign(dx)
                a.position.x -= sign * overlapX * wA
                b.position.x += sign * overlapX * wB
              } else {
                const sign = dy === 0 ? 1 : Math.sign(dy)
                a.position.y -= sign * overlapY * wA
                b.position.y += sign * overlapY * wB
              }
            }
          }
        }
      }

      // Тангенс полу-FOV предвычисляем — он не меняется. Камера статична
      // на (0,0,21), значит расстояние до плоскости z=0 = camera.position.z.
      const halfFovTan = Math.tan(camera.fov * 0.5 * (Math.PI / 180))

      renderer.setAnimationLoop(() => {
        const dt = Math.min(0.05, clock.getDelta())
        const damp = Math.pow(VELOCITY_DAMPING, dt)

        // Границы видимой области в сценских координатах. Считаем каждый
        // кадр — это копейки и при resize всегда актуально (aspect мог измениться).
        const viewH = 2 * Math.abs(camera.position.z) * halfFovTan
        const viewW = viewH * camera.aspect
        const minX = -viewW / 2 + halfCubeW
        const maxX = viewW / 2 - halfCubeW
        const minY = -viewH / 2 + halfCubeH
        const maxY = viewH / 2 - halfCubeH

        if (introPhase === 'fly' || introPhase === 'chain-wait') {
          introElapsed += dt

          if (introPhase === 'fly') {
            for (const cube of cubes) {
              const t0 = cube.userData.introFlyT0 ?? 0
              const t1 = cube.userData.introFlyT1 ?? 0
              const y0 = cube.userData.introFlyStartY ?? cube.userData.restY
              const y1 = cube.userData.restY
              const te = introElapsed
              if (te < t0) {
                cube.position.y = y0
                cube.position.x = 0
                cube.position.z = 0
              } else if (te >= t1) {
                cube.position.y = y1
                cube.position.x = 0
                cube.position.z = 0
              } else {
                const span = Math.max(1e-5, t1 - t0)
                const u = (te - t0) / span
                const eased = 1 - (1 - u) ** introFlyEasePow
                cube.position.y = THREE.MathUtils.lerp(y0, y1, eased)
                cube.position.x = 0
                cube.position.z = 0
              }
              cube.userData.velocity.set(0, 0, 0)
            }

            const allLanded = cubes.every((c) => introElapsed >= (c.userData.introFlyT1 ?? 0))
            if (allLanded) {
              introPhase = 'chain-wait'
              chainWaitElapsed = 0
            }
          } else {
            for (const cube of cubes) {
              cube.position.set(0, cube.userData.restY, 0)
              cube.userData.velocity.set(0, 0, 0)
            }
            chainWaitElapsed += dt
            if (chainWaitElapsed >= chainRevealDelaySec) {
              introPhase = 'done'
              chainPhysicsEnabled = true
              if (chainLine) chainLine.visible = true
            }
          }

          applyPlateWobble(cubes, clock.elapsedTime)

          if (
            chainLine?.visible &&
            chainGeom &&
            chainPositions &&
            chainGapCount > 0
          ) {
            fillChainGapSegments(cubes, chainPositions, chainTop, chainBot)
            chainGeom.attributes.position.needsUpdate = true
          }

          renderer.render(scene, camera)
          return
        }

        // 1) Сохраняем «доконвертные» позиции — нужны для пересчёта скоростей
        //    после проекции цепи (импульс от натяжения = Δpos / dt).
        for (const cube of cubes) {
          cube.userData.oldX = cube.position.x
          cube.userData.oldY = cube.position.y
        }

        // 2) Интегрируем как раньше: пружина для удерживаемого, затухание — для свободных.
        //    Для удерживаемого target клэмпим к границам экрана — кубик плавно
        //    подъезжает к краю и спокойно стоит, не «бьётся» о стену.
        for (const cube of cubes) {
          const v = cube.userData.velocity
          if (dragging?.mesh === cube) {
            const tgt = dragging.target
            const tx = Math.max(minX, Math.min(maxX, tgt.x))
            const ty = Math.max(minY, Math.min(maxY, tgt.y))
            // Drag-фаза: к курсору тянет пружина с критическим демпфированием.
            // a = k·(target − p) − c·v. Кубик инертно «догоняет» курсор и
            // в момент отпускания уносит с собой накопленную скорость.
            const ax = DRAG_STIFFNESS * (tx - cube.position.x) - springC * v.x
            const ay = DRAG_STIFFNESS * (ty - cube.position.y) - springC * v.y
            v.x += ax * dt
            v.y += ay * dt
            v.z = 0
          } else {
            // Free-флайт: только лёгкое затухание (космос).
            v.multiplyScalar(damp)
          }

          cube.position.x += v.x * dt
          cube.position.y += v.y * dt
          // z не трогаем — все кубики живут в плоскости z = 0.
        }

        // 3) PBD-проекции в едином итеративном цикле:
        //    a) цепь — distance constraint между соседями (|d| ≤ L);
        //    b) столкновения — AABB-разделение всех пар.
        //    Удерживаемый кубик неподвижен (вес 0): свободный сосед/партнёр
        //    получает весь сдвиг и догоняет/отскакивает. Несколько итераций
        //    распространяют натяжение и разрешают «стопки» коллизий.
        resolveChainAndCollisions()

        // 4) Position-clamp по границам экрана. Делаем ДО согласования скорости —
        //    тогда v = (clampedPos − oldPos) / dt сама по себе оказывается
        //    маленькой (стена «съела» большую часть импульса).
        for (const cube of cubes) {
          if (cube.position.x < minX) cube.position.x = minX
          else if (cube.position.x > maxX) cube.position.x = maxX
          if (cube.position.y < minY) cube.position.y = minY
          else if (cube.position.y > maxY) cube.position.y = maxY
        }

        // 5) Согласуем скорости: переносим в v реальный сдвиг за кадр,
        //    включая правки от цепи и стен. Свободный сосед, которого
        //    подтянуло, получает импульс и продолжит по инерции, когда
        //    цепь снова ослабнет.
        if (dt > 1e-5) {
          for (const cube of cubes) {
            const v = cube.userData.velocity
            v.x = (cube.position.x - cube.userData.oldX) / dt
            v.y = (cube.position.y - cube.userData.oldY) / dt
          }
        }

        // 6) Rebound от стен (только для свободных). Если кубик упёрся в
        //    границу и его остаточная скорость всё ещё «наружу» — отражаем
        //    нормальную составляющую с малым коэффициентом возврата и слегка
        //    гасим тангенциальную (трение). Удерживаемый не отражается —
        //    его уже «тормозит» пружина с клэмпнутой целью.
        if (introPhase === 'done') {
          const eps = 1e-3
          for (const cube of cubes) {
            if (dragging?.mesh === cube) continue
            const v = cube.userData.velocity
            if (cube.position.x >= maxX - eps && v.x > 0) {
              v.x = -v.x * BOUNCE_RESTITUTION
              v.y *= BOUNCE_TANGENT_FRICTION
            } else if (cube.position.x <= minX + eps && v.x < 0) {
              v.x = -v.x * BOUNCE_RESTITUTION
              v.y *= BOUNCE_TANGENT_FRICTION
            }
            if (cube.position.y >= maxY - eps && v.y > 0) {
              v.y = -v.y * BOUNCE_RESTITUTION
              v.x *= BOUNCE_TANGENT_FRICTION
            } else if (cube.position.y <= minY + eps && v.y < 0) {
              v.y = -v.y * BOUNCE_RESTITUTION
              v.x *= BOUNCE_TANGENT_FRICTION
            }
          }
        }

        // 7) Idle-покачивание. На физику не влияет, ставим абсолютные углы
        //    как sin(t·speed + phase) → амплитуда ограничена MAX_WOBBLE_TILT_RAD.
        applyPlateWobble(cubes, clock.elapsedTime)

        // 8) Цепь: только отрезки в зазорах (лицевая сторона), без вертикали по центру плашки.
        if (chainLine?.visible && chainGeom && chainPositions && chainGapCount > 0) {
          fillChainGapSegments(cubes, chainPositions, chainTop, chainBot)
          chainGeom.attributes.position.needsUpdate = true
        }

        renderer.render(scene, camera)
      })

      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(container)
      window.addEventListener('resize', onResize)
    })()

    })()

    return () => {
      cancelled = true
      setSceneReady(false)
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      if (renderer) {
        renderer.setAnimationLoop(null)
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement)
        }
        renderer.dispose()
      }
      if (scene) scene.environment = null
      environmentTarget?.dispose()
      for (const cube of cubes) {
        disposeTileResources(cube)
      }
      chainGeom?.dispose()
      chainMat?.dispose()
    }
  }, [settings])

  return (
    <section id="process" className="relative h-svh w-full bg-black">
      <div ref={containerRef} className="absolute inset-0" style={{ touchAction: 'none' }} />
      <ProcessSectionTextOverlay
        items={settings.textOverlays ?? defaults.textOverlays}
        itemDefaults={PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS}
        sceneReady={sceneReady}
        fadeTransitions={settings.fadeTransitions ?? defaults.fadeTransitions ?? true}
      />
    </section>
  )
}
