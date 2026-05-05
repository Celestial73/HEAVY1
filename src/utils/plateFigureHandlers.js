import * as THREE from 'three/webgpu'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/** @typedef {{ plateMat: import('three').MeshStandardMaterial, mergedLabel: object, spec: object, plateScale: number, cubeDepth: number, THREE: typeof THREE }} PlateFigureContext */

const registry = new Map()

/**
 * Зарегистрировать кастомную фигуру для плашки. Вызывайте до монтирования сцены (или из верхнего уровня модуля).
 * @param {string} id — в `label.object3d.handler` или в элементе `figures[]`
 * @param {(ctx: PlateFigureContext) => import('three').Object3D | import('three').Mesh | null} factory — меш/группа в локальных координатах плашки; позиция/поворот задаются в spec
 */
export function registerPlateFigure(id, factory) {
  if (typeof id !== 'string' || !factory) return
  registry.set(id, factory)
}

export function unregisterPlateFigure(id) {
  registry.delete(id)
}

export function hasPlateFigure(id) {
  return registry.has(id)
}

export function getRegisteredPlateFigureIds() {
  return [...registry.keys()]
}

/**
 * Стандартная точка «декора снизу» на плашке (как в прежнем object3d по умолчанию).
 */
export function plateFigureDefaultPosition(plateScale, cubeDepth, zBump = 0.028 * plateScale) {
  return [0, -0.78 * plateScale, cubeDepth * 0.5 + zBump]
}

export function resolvePlateModelUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

const fbxTemplatePromises = new Map()

function loadPlateFbxTemplate(absoluteUrl) {
  if (!fbxTemplatePromises.has(absoluteUrl)) {
    const loader = new FBXLoader()
    fbxTemplatePromises.set(
      absoluteUrl,
      loader
        .loadAsync(absoluteUrl)
        .then((root) => {
          convertFbxMaterialsToStandard(root)
          return root
        })
        .catch((err) => {
          fbxTemplatePromises.delete(absoluteUrl)
          throw err
        }),
    )
  }
  return fbxTemplatePromises.get(absoluteUrl)
}

/**
 * FBX часто даёт MeshPhong/Lambert; для WebGPURenderer надёжнее MeshStandardMaterial с теми же картами.
 */
function convertFbxMaterialsToStandard(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    const mat = child.material
    const list = Array.isArray(mat) ? mat : [mat]
    const next = list.map((m) => {
      if (!m || m.isMeshStandardMaterial) return m
      const std = new THREE.MeshStandardMaterial()
      if (m.map) std.map = m.map
      if (m.lightMap) std.lightMap = m.lightMap
      if (m.normalMap) std.normalMap = m.normalMap
      if (m.aoMap) std.aoMap = m.aoMap
      if (m.emissiveMap) std.emissiveMap = m.emissiveMap
      if (m.alphaMap) std.alphaMap = m.alphaMap
      std.color.copy(m.color)
      if (m.emissive) std.emissive.copy(m.emissive)
      std.emissiveIntensity = m.emissiveIntensity ?? 1
      if (m.opacity !== undefined) std.opacity = m.opacity
      std.transparent = Boolean(m.transparent || (m.opacity !== undefined && m.opacity < 1))
      if (m.side !== undefined) std.side = m.side
      if (m.shininess !== undefined) {
        std.roughness = Math.max(0.12, 1 - Math.min(m.shininess / 100, 0.92))
      } else {
        std.roughness = 0.72
      }
      std.metalness = 0.08
      std.envMapIntensity = 1
      m.dispose()
      return std
    })
    child.material = Array.isArray(mat) ? next : next[0]
  })
}

/**
 * Асинхронно подгружает FBX и добавляет на плашку (центр модели в начале координат группы, масштаб под `size` / `fbxFitSize`).
 * @returns {Promise<import('three').Group | null>}
 */
export async function appendFbxPlateDeco(tile, spec, scaleCtx) {
  if (!tile || !spec?.fbxUrl || spec.enabled === false) return null
  const T = scaleCtx.three ?? THREE
  const url = resolvePlateModelUrl(spec.fbxUrl)
  const template = await loadPlateFbxTemplate(url)
  const root = template.clone(true)
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = spec.castShadow !== false
      o.receiveShadow = spec.receiveShadow !== false
    }
  })
  const wrap = new T.Group()
  wrap.add(root)
  wrap.updateMatrixWorld(true)
  const box = new T.Box3().setFromObject(wrap)
  const center = box.getCenter(new T.Vector3())
  root.position.sub(center)
  wrap.updateMatrixWorld(true)
  const boxSized = new T.Box3().setFromObject(wrap)
  const sz = boxSized.getSize(new T.Vector3())
  const maxDim = Math.max(sz.x, sz.y, sz.z, 1e-6)
  const { plateScale } = scaleCtx
  const target = spec.fbxFitSize ?? spec.size ?? 0.44 * plateScale
  wrap.scale.setScalar(target / maxDim)
  applyFigureTransform(wrap, spec, scaleCtx.plateScale, scaleCtx.cubeDepth)
  wrap.renderOrder = spec.renderOrder ?? 2
  tile.add(wrap)
  return wrap
}

const gltfTemplatePromises = new Map()

function resolveGltfModelUrl(spec) {
  const raw = spec?.gltfUrl ?? spec?.glbUrl
  if (!raw) return null
  return resolvePlateModelUrl(raw)
}

function loadPlateGltfTemplate(absoluteUrl) {
  if (!gltfTemplatePromises.has(absoluteUrl)) {
    const loader = new GLTFLoader()
    gltfTemplatePromises.set(
      absoluteUrl,
      loader
        .loadAsync(absoluteUrl)
        .then((gltf) => gltf.scene)
        .catch((err) => {
          gltfTemplatePromises.delete(absoluteUrl)
          throw err
        }),
    )
  }
  return gltfTemplatePromises.get(absoluteUrl)
}

/**
 * glTF / GLB на плашку (как FBX: центр bbox, масштаб по `size` / `gltfFitSize`).
 */
export async function appendGltfPlateDeco(tile, spec, scaleCtx) {
  const absoluteUrl = resolveGltfModelUrl(spec)
  if (!tile || !absoluteUrl || spec.enabled === false) return null
  const T = scaleCtx.three ?? THREE
  const template = await loadPlateGltfTemplate(absoluteUrl)
  const root = template.clone(true)
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = spec.castShadow !== false
      o.receiveShadow = spec.receiveShadow !== false
    }
  })
  const wrap = new T.Group()
  wrap.add(root)
  wrap.updateMatrixWorld(true)
  const box = new T.Box3().setFromObject(wrap)
  const center = box.getCenter(new T.Vector3())
  root.position.sub(center)
  wrap.updateMatrixWorld(true)
  const boxSized = new T.Box3().setFromObject(wrap)
  const sz = boxSized.getSize(new T.Vector3())
  const maxDim = Math.max(sz.x, sz.y, sz.z, 1e-6)
  const { plateScale } = scaleCtx
  const target = spec.gltfFitSize ?? spec.size ?? 0.44 * plateScale
  wrap.scale.setScalar(target / maxDim)
  applyFigureTransform(wrap, spec, scaleCtx.plateScale, scaleCtx.cubeDepth)
  wrap.renderOrder = spec.renderOrder ?? 2
  tile.add(wrap)
  return wrap
}

/**
 * Плоскость с JPEG/PNG/WebP на лице плашки (асинхронная загрузка).
 * `size` или `imageWidth` — ширина в юнитах сцены; высота из пропорций картинки.
 */
export async function appendPlateImageDeco(tile, spec, scaleCtx) {
  if (!tile || !spec?.imageUrl || spec.enabled === false) return null
  const T = scaleCtx.three ?? THREE
  const url = resolvePlateModelUrl(spec.imageUrl)
  const loader = new T.TextureLoader()
  let tex
  try {
    tex = await loader.loadAsync(url)
  } catch (err) {
    console.error('appendPlateImageDeco: failed to load', url, err)
    throw err
  }
  tex.colorSpace = T.SRGBColorSpace
  tex.needsUpdate = true
  const img = tex.image
  const iw = img?.width > 0 ? img.width : 1
  const ih = img?.height > 0 ? img.height : 1
  const aspect = iw / ih
  const planeW = spec.imageWidth ?? spec.size ?? 0.55 * scaleCtx.plateScale * 1.25
  const planeH = planeW / aspect
  const geom = new T.PlaneGeometry(planeW, planeH)
  const mat = new T.MeshStandardMaterial({
    map: tex,
    metalness: 0,
    roughness: 1,
    envMapIntensity: spec.envMapIntensity ?? 1,
    transparent: spec.transparent === true,
    opacity: spec.opacity ?? 1,
    depthWrite: spec.depthWrite !== false,
    side: spec.side === 'front' ? T.FrontSide : T.DoubleSide,
  })
  const mesh = new T.Mesh(geom, mat)
  mesh.renderOrder = spec.renderOrder ?? 3

  const { plateScale, cubeDepth } = scaleCtx
  const labelFrontZ = cubeDepth * 0.5 + 0.002 * plateScale
  const minZ = labelFrontZ + (spec.imageZBias ?? 0.018 * plateScale)
  const p = spec.position ?? plateFigureDefaultPosition(plateScale, cubeDepth)
  const r = spec.rotation ?? [0, 0, 0]
  mesh.position.set(p[0], p[1], Math.max(p[2], minZ))
  mesh.rotation.set(r[0], r[1], r[2])
  if (spec.scale !== undefined) {
    if (typeof spec.scale === 'number') mesh.scale.setScalar(spec.scale)
    else mesh.scale.set(spec.scale[0], spec.scale[1], spec.scale[2])
  }

  tile.add(mesh)
  return mesh
}

function decoMaterialFromPlate(plateMat, spec) {
  const mat = plateMat.clone()
  mat.map = null
  mat.normalMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.normalScale = new THREE.Vector2(1, 1)
  if (spec.color !== undefined) mat.color.setHex(spec.color)
  else mat.color.multiplyScalar(1.04)
  mat.metalness = spec.metalness ?? 0.85
  mat.roughness = spec.roughness ?? 0.4
  return mat
}

function createPrimitiveGeometry(spec, primitive, plateScale, T) {
  const size = spec.size ?? 0.44 * plateScale
  switch (primitive) {
    case 'box':
      return new T.BoxGeometry(size, size, size * 0.75)
    case 'torusKnot':
      return new T.TorusKnotGeometry(size * 0.32, size * 0.11, 48, 12)
    case 'icosahedron':
      return new T.IcosahedronGeometry(size * 0.5, 0)
    case 'cone':
      return new T.ConeGeometry(size * 0.45, size * 0.88, 32)
    case 'cylinder':
      return new T.CylinderGeometry(size * 0.4, size * 0.4, size * 0.85, 32)
    case 'torus':
      return new T.TorusGeometry(size * 0.38, size * 0.1, 24, 32)
    case 'sphere':
    default:
      return new T.SphereGeometry(size * 0.5, 32, 24)
  }
}

function makePrimitiveHandler(primitive) {
  return (ctx) => {
    const { spec, plateScale, THREE: T } = ctx
    const geom = createPrimitiveGeometry(spec, primitive, plateScale, T)
    const mesh = new T.Mesh(geom, decoMaterialFromPlate(ctx.plateMat, spec))
    return mesh
  }
}

function registerBuiltinPrimitives() {
  for (const name of [
    'sphere',
    'box',
    'torusKnot',
    'icosahedron',
    'cone',
    'cylinder',
    'torus',
  ]) {
    registerPlateFigure(name, makePrimitiveHandler(name))
  }
}

registerBuiltinPrimitives()

function applyFigureTransform(obj, spec, plateScale, cubeDepth) {
  const p = spec.position ?? plateFigureDefaultPosition(plateScale, cubeDepth)
  const r = spec.rotation ?? [0, 0, 0]
  obj.position.set(p[0], p[1], p[2])
  obj.rotation.set(r[0], r[1], r[2])
  if (spec.scale !== undefined) {
    if (typeof spec.scale === 'number') obj.scale.setScalar(spec.scale)
    else obj.scale.set(spec.scale[0], spec.scale[1], spec.scale[2])
  }
}

/**
 * Собрать меши декора по `mergedLabel.object3d`.
 *
 * Поддержка:
 * - один объект: `{ enabled, primitive | handler, size, position, ... }`
 * - несколько: `{ enabled, figures: [ { handler, ... }, { primitive: 'box', ... } ], defaults?: { size } }`
 * - только `fbxUrl` — синхронных мешей нет; загрузка через `appendFbxPlateDeco` в сцене
 * - только `imageUrl` — плоскость с текстурой; `appendPlateImageDeco` в сцене
 * - только `gltfUrl` или `glbUrl` — `appendGltfPlateDeco`
 *
 * @param {import('three').MeshStandardMaterial} plateMat
 * @param {object} mergedLabel
 * @param {{ plateScale: number, cubeDepth: number, three?: typeof THREE }} scaleCtx
 * @returns {import('three').Object3D[]}
 */
export function createPlateFigureObjects(plateMat, mergedLabel, scaleCtx) {
  const od = mergedLabel?.object3d
  if (!od || od.enabled === false) return []

  const onlyFbx =
    Boolean(od.fbxUrl) &&
    !od.primitive &&
    !od.handler &&
    !od.figure &&
    !(Array.isArray(od.figures) && od.figures.length > 0)
  if (onlyFbx) return []

  const onlyGltf =
    Boolean(od.gltfUrl ?? od.glbUrl) &&
    !od.primitive &&
    !od.handler &&
    !od.figure &&
    !(Array.isArray(od.figures) && od.figures.length > 0)
  if (onlyGltf) return []

  const onlyImage =
    Boolean(od.imageUrl) &&
    !od.primitive &&
    !od.handler &&
    !od.figure &&
    !(Array.isArray(od.figures) && od.figures.length > 0)
  if (onlyImage) return []

  const T = scaleCtx.three ?? THREE
  const { plateScale, cubeDepth } = scaleCtx

  const baseCtx = {
    plateMat,
    mergedLabel,
    plateScale,
    cubeDepth,
    THREE: T,
  }

  const useList = Array.isArray(od.figures) && od.figures.length > 0
  const specs = useList ? od.figures : [od]
  const defaults = od.defaults && typeof od.defaults === 'object' ? od.defaults : {}

  const out = []
  for (const raw of specs) {
    const spec = { ...defaults, ...raw }
    if (spec.enabled === false) continue

    const handlerId = spec.handler ?? spec.figure
    let obj = null
    const ctx = { ...baseCtx, spec }

    if (handlerId && registry.has(handlerId)) {
      obj = registry.get(handlerId)(ctx)
    } else if (spec.primitive) {
      const fac = registry.get(spec.primitive) ?? registry.get('sphere')
      if (fac) obj = fac(ctx)
    }

    if (obj) {
      applyFigureTransform(obj, spec, plateScale, cubeDepth)
      obj.renderOrder = spec.renderOrder ?? 2
      out.push(obj)
    }
  }

  return out
}
