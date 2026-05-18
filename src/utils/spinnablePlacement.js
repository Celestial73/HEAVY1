import * as THREE from 'three'

function pickRandomItems(items, count) {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)))
}

function pickFromSpinnablePool(pool, randomCount) {
  const items = pool ?? []
  const fixed = items.filter((cfg) => cfg.alwaysInclude === true)
  const optional = items.filter((cfg) => cfg.alwaysInclude !== true)
  return [...fixed, ...pickRandomItems(optional, randomCount ?? 0)]
}

/**
 * Собирает список spinnable для сцены: large/small пулы + alwaysInclude.
 * Legacy: если задан только `spinnables`, используется `randomSpinnablesCount`.
 */
export function selectSpinnablesForScene(settings) {
  const hasSplitPools =
    (settings.spinnablesLarge?.length ?? 0) > 0 || (settings.spinnablesSmall?.length ?? 0) > 0

  if (!hasSplitPools && settings.spinnables?.length) {
    return pickFromSpinnablePool(settings.spinnables, settings.randomSpinnablesCount ?? 0)
  }

  return [
    ...pickFromSpinnablePool(settings.spinnablesLarge, settings.randomLargeSpinnablesCount),
    ...pickFromSpinnablePool(settings.spinnablesSmall, settings.randomSmallSpinnablesCount),
  ]
}

const _localMin = new THREE.Vector3()
const _localMax = new THREE.Vector3()

/**
 * Полуразмеры кубического hitbox в локальной системе mesh (центр = position mesh).
 * `cfg.hitbox.halfExtents` | `cfg.hitbox.size` — явно; иначе из bounds модели.
 */
export function resolveHitboxHalfExtents(cfg, mesh, placement = {}) {
  const scale = placement.hitboxScale ?? 1
  const hb = cfg.hitbox
  let halfExtents

  if (hb?.halfExtents?.length === 3) {
    halfExtents = hb.halfExtents.map((v) => Math.max(0.05, Number(v)))
  } else if (hb?.size?.length === 3) {
    halfExtents = hb.size.map((v) => Math.max(0.05, Number(v) / 2))
  } else {
    const bounds = new THREE.Box3().setFromObject(mesh)
    const size = bounds.getSize(new THREE.Vector3())
    const autoPadding = placement.autoHitboxPadding ?? 1.25
    const rotationFactor = placement.hitboxRotationFactor ?? 1.35
    const maxHalf = Math.max(size.x, size.y, size.z) * 0.5 * autoPadding * rotationFactor
    halfExtents = [maxHalf, maxHalf, maxHalf]
  }

  const scaled = scale === 1 ? halfExtents : halfExtents.map((v) => v * scale)
  if (placement.hitboxCubicize === false) return scaled

  const maxHalf = Math.max(...scaled)
  return [maxHalf, maxHalf, maxHalf]
}

/** Мировой AABB hitbox с учётом position / rotation / scale mesh. */
export function getWorldHitboxAABB(mesh, halfExtents) {
  const [hx, hy, hz] = halfExtents
  _localMin.set(-hx, -hy, -hz)
  _localMax.set(hx, hy, hz)
  const box = new THREE.Box3(_localMin.clone(), _localMax.clone())
  mesh.updateMatrixWorld(true)
  box.applyMatrix4(mesh.matrixWorld)
  return box
}

/** true, если AABB пересекаются (с зазором gap между гранями). */
export function hitboxesOverlap(a, b, gap = 0) {
  return !(
    a.max.x + gap < b.min.x ||
    a.min.x - gap > b.max.x ||
    a.max.y + gap < b.min.y ||
    a.min.y - gap > b.max.y ||
    a.max.z + gap < b.min.z ||
    a.min.z - gap > b.max.z
  )
}

/**
 * Минимальный зазор между поверхностями AABB (>0 — разделены, <0 — проникновение).
 * Infinity, если placed пуст.
 */
export function minHitboxSeparation(candidate, placed, gap = 0) {
  if (!placed.length) return Infinity
  let minSep = Infinity
  for (const other of placed) {
    const sepX = Math.min(candidate.max.x - other.min.x, other.max.x - candidate.min.x) - gap
    const sepY = Math.min(candidate.max.y - other.min.y, other.max.y - candidate.min.y) - gap
    const sepZ = Math.min(candidate.max.z - other.min.z, other.max.z - candidate.min.z) - gap
    const sep = Math.min(sepX, sepY, sepZ)
    if (sep < minSep) minSep = sep
  }
  return minSep
}

const NO_ROTATION = { x: 0, y: 0, z: 0 }

/** Случайный поворот после расстановки (на hitbox-ы не влияет). */
export function randomVisualRotation(placement) {
  if (!placement.randomizeRotation) return NO_ROTATION
  return {
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    z: Math.random() * Math.PI * 2,
  }
}

/** Оценка «занимаемого» объёма в мире — для сортировки (крупные ставим раньше). */
export function estimateHitboxSortMetric(cfg, mesh, placement = {}) {
  const local = resolveHitboxHalfExtents(cfg, mesh, placement)
  const worldScale = new THREE.Vector3()
  mesh.getWorldScale(worldScale)
  const s = Math.max(worldScale.x, worldScale.y, worldScale.z, 1e-6)
  const maxLocal = Math.max(...local)
  return maxLocal * s
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function buildGridCandidates(area, minY, maxY, step) {
  const points = []
  const s = Math.max(step, 0.25)
  for (let x = area.minX; x <= area.maxX + 1e-6; x += s) {
    for (let z = area.minZ; z <= area.maxZ + 1e-6; z += s) {
      for (let y = minY; y <= maxY + 1e-6; y += s) {
        points.push({ x, y, z })
      }
    }
  }
  return shuffleInPlace(points)
}

function tryCandidatePosition(mesh, halfExtents, placement, placedBoxes, x, y, z, rot) {
  const gap = placement.hitboxGap ?? 0.15
  mesh.position.set(x, y, z)
  mesh.rotation.set(rot.x, rot.y, rot.z)
  const worldBox = getWorldHitboxAABB(mesh, halfExtents)
  const overlaps = placedBoxes.some((box) => hitboxesOverlap(worldBox, box, gap))
  return overlaps ? null : { x, y, z, worldBox, rotation: rot }
}

function randomPlacementScale(placement) {
  if (!placement.random || !placement.randomScale) return 1
  return THREE.MathUtils.lerp(
    placement.scaleMin ?? 1,
    placement.scaleMax ?? 1,
    Math.random(),
  )
}

/**
 * Подбирает позицию без пересечения hitbox-ов. Возвращает { x, y, z, worldBox }.
 */
export function placeSpinnableMesh(mesh, cfg, placement, placedBoxes) {
  const halfExtents = resolveHitboxHalfExtents(cfg, mesh, placement)
  const gap = placement.hitboxGap ?? 0.15
  const maxAttempts = placement.maxAttempts ?? 64
  const area = placement.area

  const scaleFactor = randomPlacementScale(placement)
  if (scaleFactor !== 1) {
    mesh.scale.multiplyScalar(scaleFactor)
  }

  const baseX = cfg.position[0]
  const baseY = cfg.position[1]
  const baseZ = cfg.position[2]

  if (!placement.random) {
    mesh.position.set(baseX, baseY, baseZ)
    mesh.rotation.set(0, 0, 0)
    const worldBox = getWorldHitboxAABB(mesh, halfExtents)
    const placementOk = !placedBoxes.some((box) => hitboxesOverlap(worldBox, box, gap))
    return {
      x: baseX,
      y: baseY,
      z: baseZ,
      halfExtents,
      worldBox,
      visualRotation: randomVisualRotation(placement),
      placementOk,
    }
  }

  let bestX = baseX
  let bestY = baseY
  let bestZ = baseZ
  let bestBox = null
  let bestSeparation = -Infinity

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candX = THREE.MathUtils.lerp(area.minX, area.maxX, Math.random())
    const candY = THREE.MathUtils.lerp(placement.minY, placement.maxY, Math.random())
    const candZ = THREE.MathUtils.lerp(area.minZ, area.maxZ, Math.random())

    const hit = tryCandidatePosition(
      mesh,
      halfExtents,
      placement,
      placedBoxes,
      candX,
      candY,
      candZ,
      NO_ROTATION,
    )
    if (hit) {
      return {
        ...hit,
        halfExtents,
        scaleFactor,
        visualRotation: randomVisualRotation(placement),
        placementOk: true,
      }
    }

    mesh.position.set(candX, candY, candZ)
    mesh.rotation.set(0, 0, 0)
    const candBox = getWorldHitboxAABB(mesh, halfExtents)
    const separation = minHitboxSeparation(candBox, placedBoxes, gap)
    if (separation > bestSeparation) {
      bestSeparation = separation
      bestX = candX
      bestY = candY
      bestZ = candZ
      bestBox = candBox
    }
  }

  const maxHalf = Math.max(...halfExtents)
  const gridStep = 2 * maxHalf + gap
  const grid = buildGridCandidates(area, placement.minY, placement.maxY, gridStep)
  const gridLimit = placement.maxGridSamples ?? 400
  for (let i = 0; i < Math.min(grid.length, gridLimit); i += 1) {
    const p = grid[i]
    const hit = tryCandidatePosition(
      mesh,
      halfExtents,
      placement,
      placedBoxes,
      p.x,
      p.y,
      p.z,
      NO_ROTATION,
    )
    if (hit) {
      return {
        ...hit,
        halfExtents,
        scaleFactor,
        visualRotation: randomVisualRotation(placement),
        placementOk: true,
      }
    }
  }

  mesh.position.set(bestX, bestY, bestZ)
  mesh.rotation.set(0, 0, 0)
  const worldBox =
    bestBox ??
    tryCandidatePosition(mesh, halfExtents, placement, placedBoxes, bestX, bestY, bestZ, NO_ROTATION)
      ?.worldBox ??
    getWorldHitboxAABB(mesh, halfExtents)

  return {
    x: bestX,
    y: bestY,
    z: bestZ,
    halfExtents,
    worldBox,
    scaleFactor,
    visualRotation: randomVisualRotation(placement),
    fallback: true,
    placementOk: false,
  }
}

const HITBOX_DEBUG_NAME = 'hitbox-debug'
export const PLACEMENT_AREA_DEBUG_NAME = 'placement-area-debug'

function createDebugBoxGroup(width, height, depth, style) {
  const group = new THREE.Group()
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: style.fillColor ?? 0xffffff,
      transparent: true,
      opacity: style.fillOpacity ?? 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  fill.renderOrder = 998
  fill.raycast = () => {}
  group.add(fill)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: style.edgeColor ?? 0xffffff,
      transparent: true,
      opacity: style.edgeOpacity ?? 0.7,
    }),
  )
  edges.renderOrder = 999
  edges.raycast = () => {}
  group.add(edges)

  return group
}

function resolveHitboxDebugStyle(debug, placementOk) {
  const preset = placementOk ? debug.ok : debug.collision
  const fillFallback = placementOk ? 0x44ff88 : 0xff4444
  const edgeFallback = placementOk ? 0x66ffaa : 0xff6666
  return {
    fillColor: preset?.fillColor ?? debug.fillColor ?? fillFallback,
    fillOpacity: preset?.fillOpacity ?? debug.fillOpacity ?? (placementOk ? 0.2 : 0.25),
    edgeColor: preset?.edgeColor ?? debug.edgeColor ?? edgeFallback,
    edgeOpacity: preset?.edgeOpacity ?? debug.edgeOpacity ?? (placementOk ? 0.85 : 0.9),
  }
}

/** Полупрозрачный куб hitbox в локальных координатах mesh (центр = origin). */
export function createHitboxDebugHelper(halfExtents, debug = {}) {
  const [hx, hy, hz] = halfExtents
  const group = createDebugBoxGroup(hx * 2, hy * 2, hz * 2, debug)
  group.name = HITBOX_DEBUG_NAME
  return group
}

/** Зона расстановки: placement.area + minY/maxY (мировые координаты). */
export function createPlacementAreaDebugHelper(placement, debug = {}) {
  const area = placement?.area
  if (!area) return null

  const minY = placement.minY ?? 0
  const maxY = placement.maxY ?? 0
  const width = area.maxX - area.minX
  const height = maxY - minY
  const depth = area.maxZ - area.minZ
  if (width <= 0 || height <= 0 || depth <= 0) return null

  const style = debug.placementArea ?? {}
  const group = createDebugBoxGroup(width, height, depth, {
    fillColor: style.fillColor ?? 0x4488ff,
    fillOpacity: style.fillOpacity ?? 0.1,
    edgeColor: style.edgeColor ?? 0x6699ff,
    edgeOpacity: style.edgeOpacity ?? 0.55,
  })
  group.name = PLACEMENT_AREA_DEBUG_NAME
  group.position.set(
    (area.minX + area.maxX) * 0.5,
    (minY + maxY) * 0.5,
    (area.minZ + area.maxZ) * 0.5,
  )
  return group
}

export function attachHitboxDebugHelper(mesh, halfExtents, debug = {}, placementOk = true) {
  const existing = mesh.getObjectByName(HITBOX_DEBUG_NAME)
  if (existing) mesh.remove(existing)
  mesh.add(createHitboxDebugHelper(halfExtents, resolveHitboxDebugStyle(debug, placementOk)))
}
