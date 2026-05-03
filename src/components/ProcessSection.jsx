import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createMetalProceduralMaps } from '../utils/metalProceduralTextures.js'
import { PROCESS_SECTION_SETTINGS as defaults } from '../config/processSectionSettings.js'

function mergeMaterialOptions(defaultsObj, userObj = {}) {
  const out = { ...defaultsObj }
  for (const [k, v] of Object.entries(userObj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/** Размеры «плитки» (масштаб ×1.5 относительно базы 2×1.6×0.25). */
const CUBE_WIDTH = 4.5
const CUBE_HEIGHT = 3.3
const CUBE_DEPTH = 0.375
/** Полоса рамки (от края плашки к центру) и выступ вперёд (+Z, к камере). */
const FRAME_RAIL = 0.15
const FRAME_OUTSET = 0.075
/** Фаски RoundedBoxGeometry: радиус скругления рёбер (сегменты дуги). */
const PLATE_BEVEL_RADIUS = 0.063
const PLATE_BEVEL_SEGMENTS = 2
const FRAME_BEVEL_RADIUS = 0.021
const FRAME_BEVEL_SEGMENTS = 1
/** Промежуток между соседними плитками (по Y, поверх их собственной высоты). */
const CUBE_GAP = 1.35

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
 *  - CHAIN_LENGTH должна быть > начального расстояния между кубиками
 *    (CUBE_HEIGHT + CUBE_GAP) — сейчас ~3.75, запас в длине звена.
 *  - CONSTRAINT_ITERATIONS — сколько раз за кадр прогоняем все звенья и
 *    столкновения. Больше итераций = стабильнее распространение через
 *    несколько звеньев и устойчивее разрешение коллизий стопками. 8
 *    хватает для 4 кубиков.
 */
const CHAIN_LENGTH = 4.5
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
const COLLIDER_PADDING = 0.03

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

/** Группа: корпус плашки + лицевая рамка по периметру (выступ по +Z к камере). */
function buildPlateWithBezel(plateMat) {
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
    const m = ch.material
    if (Array.isArray(m)) m.forEach((mm) => materials.add(mm))
    else if (m) materials.add(m)
  })
  materials.forEach((m) => m.dispose())
}

export default function ProcessSection() {
  const containerRef = useRef(null)
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/processSectionSettings.js', (mod) => {
      if (mod?.PROCESS_SECTION_SETTINGS) setSettings(mod.PROCESS_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const cubeSpecs = settings.cubes
    const cubeCount = cubeSpecs.length
    if (cubeCount < 1) return undefined

    let renderer = null
    let resizeObserver = null
    let cancelled = false
    let environmentTarget = null

    const scene = new THREE.Scene()
    scene.background = null

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 21)
    camera.lookAt(0, 0, 0)

    // Освещение: мягкая заливка + ключ + холодная подсветка сзади.
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    keyLight.position.set(5, 6, 8)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x88aaff, 0.6)
    rimLight.position.set(-5, -3, -6)
    scene.add(rimLight)

    // Кубики: вертикальная колонка по Y. Каждый — отдельный физический объект
    // с собственным velocity. Z = 0, drag живёт в плоскости z=0.
    const cubes = []
    const stride = CUBE_HEIGHT + CUBE_GAP
    const totalHeight = (cubeCount - 1) * stride
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
      const tile = buildPlateWithBezel(mat)
      tile.userData.proceduralDispose = proceduralDispose
      tile.position.set(0, topY - i * stride, 0)
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

    // Визуальная цепь: ломаная линия через центры кубиков. Пунктир делает её
    // похожей на сегментированную цепь, не углубляясь в честную геометрию звеньев.
    const chainGeom = new THREE.BufferGeometry()
    const chainPositions = new Float32Array(cubes.length * 3)
    for (let i = 0; i < cubes.length; i += 1) {
      chainPositions[i * 3] = cubes[i].position.x
      chainPositions[i * 3 + 1] = cubes[i].position.y
      chainPositions[i * 3 + 2] = cubes[i].position.z
    }
    chainGeom.setAttribute('position', new THREE.BufferAttribute(chainPositions, 3))
    const chainMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      dashSize: 0.27,
      gapSize: 0.18,
    })
    const chainLine = new THREE.Line(chainGeom, chainMat)
    chainLine.computeLineDistances()
    scene.add(chainLine)

    const onResize = () => {
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

      // Тангенс полу-FOV предвычисляем — он не меняется. Камера статична
      // на (0,0,21), значит расстояние до плоскости z=0 = camera.position.z.
      const halfFovTan = Math.tan(camera.fov * 0.5 * (Math.PI / 180))
      const halfCubeW = CUBE_WIDTH / 2
      const halfCubeH = CUBE_HEIGHT / 2

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
        const collW = halfCubeW + COLLIDER_PADDING
        const collH = halfCubeH + COLLIDER_PADDING

        for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter += 1) {
          // a) Цепь
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

          // b) Столкновения — все пары (i, j), i<j. AABB перекрытие → push
          //    по оси минимальной пенетрации. Дёшево: для 4 кубиков всего 6 пар.
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
                // Раздвигаем по X: знак = направление от a к b. Если кубики
                // строго совпали (dx=0) — берём +1 как дефолт.
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

        // 7) Idle-покачивание. На физику не влияет, ставим абсолютные углы
        //    как sin(t·speed + phase) → амплитуда ограничена MAX_WOBBLE_TILT_RAD.
        const now = clock.elapsedTime
        for (const cube of cubes) {
          const w = cube.userData.wobble
          cube.rotation.x = MAX_WOBBLE_TILT_RAD * Math.sin(now * w.speedX + w.phaseX)
          cube.rotation.y = MAX_WOBBLE_TILT_RAD * Math.sin(now * w.speedY + w.phaseY)
          cube.rotation.z = MAX_WOBBLE_TILT_RAD * Math.sin(now * w.speedZ + w.phaseZ)
        }

        // 8) Обновляем геометрию визуальной цепи и пересчитываем lineDistances
        //    (нужно для пунктира — без этого штрихи «съезжают» при движении).
        for (let i = 0; i < cubes.length; i += 1) {
          chainPositions[i * 3] = cubes[i].position.x
          chainPositions[i * 3 + 1] = cubes[i].position.y
          chainPositions[i * 3 + 2] = cubes[i].position.z
        }
        chainGeom.attributes.position.needsUpdate = true
        chainLine.computeLineDistances()

        renderer.render(scene, camera)
      })

      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(container)
      window.addEventListener('resize', onResize)
    })()

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      if (renderer) {
        renderer.setAnimationLoop(null)
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement)
        }
        renderer.dispose()
      }
      scene.environment = null
      environmentTarget?.dispose()
      for (const cube of cubes) {
        disposeTileResources(cube)
      }
      chainGeom.dispose()
      chainMat.dispose()
    }
  }, [settings])

  return (
    <section id="process" className="relative h-svh w-full bg-black">
      <div ref={containerRef} className="absolute inset-0" style={{ touchAction: 'none' }} />
    </section>
  )
}
