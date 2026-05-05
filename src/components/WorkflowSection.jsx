import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import {
  Fn,
  mix,
  mul,
  pass,
  screenCoordinate,
  screenUV,
  texture3D,
  time,
  uniform,
  vec3,
  add,
} from 'three/tsl'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { bayer16 } from 'three/addons/tsl/math/Bayer.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import {
  appendFbxPlateDeco,
  appendGltfPlateDeco,
  appendPlateImageDeco,
  createPlateFigureObjects,
} from '../utils/plateFigureHandlers.js'
import { createMetalProceduralMaps } from '../utils/metalProceduralTextures.js'
import ProcessSectionTextOverlay from './ProcessSectionTextOverlay.jsx'
import {
  PROCESS_SECTION_SETTINGS as processDefaults,
  PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS,
  WORKFLOW_DISABLE_VOLUMETRIC_ON_MOBILE,
  WORKFLOW_LIGHT_SETTINGS,
  WORKFLOW_VOLUMETRIC_MOBILE_OVERRIDES,
  WORKFLOW_VOLUMETRIC_SETTINGS,
} from '../config/processSectionSettings.js'
import { isWorkflowMobileProfile } from '../utils/workflowMobileProfile.js'
import { WORKFLOW_SECTION_SPLASH } from '../config/sectionSplashSettings.js'
import SectionSplashOverlay from './SectionSplashOverlay.jsx'

function createTexture3D(cfg) {
  const data = new Uint8Array(cfg.size * cfg.size * cfg.size)
  const perlin = new ImprovedNoise()
  let i = 0
  for (let z = 0; z < cfg.size; z += 1) {
    for (let y = 0; y < cfg.size; y += 1) {
      for (let x = 0; x < cfg.size; x += 1) {
        const nx = (x / cfg.size) * cfg.repeatFactor
        const ny = (y / cfg.size) * cfg.repeatFactor
        const nz = (z / cfg.size) * cfg.repeatFactor
        data[i] = 128 + 128 * perlin.noise(nx * cfg.perlinScale, ny * cfg.perlinScale, nz * cfg.perlinScale)
        i += 1
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, cfg.size, cfg.size, cfg.size)
  tex.format = cfg.format
  tex.minFilter = cfg.minFilter
  tex.magFilter = cfg.magFilter
  tex.wrapS = cfg.wrapS
  tex.wrapT = cfg.wrapT
  tex.unpackAlignment = cfg.unpackAlignment
  tex.needsUpdate = true
  return tex
}

function deepMergeWorkflowConfig(a, b) {
  if (!b) return { ...a }
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue
    if (Array.isArray(v)) {
      out[k] = v
    } else if (v !== null && typeof v === 'object') {
      out[k] = deepMergeWorkflowConfig(a[k] ?? {}, v)
    } else {
      out[k] = v
    }
  }
  return out
}

function resolveWorkflowVolumetricSettings(source = WORKFLOW_VOLUMETRIC_SETTINGS) {
  const r = source.renderer ?? {}
  const textureCfg = source.noiseTexture3D ?? {}
  const mapTone = {
    neutral: THREE.NeutralToneMapping,
    aces: THREE.ACESFilmicToneMapping,
    cineon: THREE.CineonToneMapping,
    linear: THREE.LinearToneMapping,
    reinhard: THREE.ReinhardToneMapping,
  }
  const mapFilter = {
    linear: THREE.LinearFilter,
    nearest: THREE.NearestFilter,
  }
  const mapWrap = {
    repeat: THREE.RepeatWrapping,
    clamp: THREE.ClampToEdgeWrapping,
    mirrored: THREE.MirroredRepeatWrapping,
  }
  const mapFormat = {
    red: THREE.RedFormat,
  }
  const mapShadowType = {
    basic: THREE.BasicShadowMap,
    pcf: THREE.PCFShadowMap,
    pcfsoft: THREE.PCFSoftShadowMap,
    vsm: THREE.VSMShadowMap,
  }

  return {
    ...source,
    renderer: {
      antialias: r.antialias ?? true,
      maxPixelRatio: r.maxPixelRatio ?? 2,
      toneMapping: mapTone[r.toneMapping] ?? THREE.NeutralToneMapping,
      toneMappingExposure: r.toneMappingExposure ?? 1.5,
      shadowMapEnabled: r.shadowMapEnabled ?? true,
      shadowMapType: mapShadowType[r.shadowMapType] ?? THREE.PCFShadowMap,
    },
    noiseTexture3D: {
      ...textureCfg,
      format: mapFormat[textureCfg.format] ?? THREE.RedFormat,
      minFilter: mapFilter[textureCfg.minFilter] ?? THREE.LinearFilter,
      magFilter: mapFilter[textureCfg.magFilter] ?? THREE.LinearFilter,
      wrapS: mapWrap[textureCfg.wrapS] ?? THREE.RepeatWrapping,
      wrapT: mapWrap[textureCfg.wrapT] ?? THREE.RepeatWrapping,
    },
  }
}

function createSpotColorMap(cfg) {
  const canvas = document.createElement('canvas')
  canvas.width = cfg.size
  canvas.height = cfg.size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createLinearGradient(0, 0, cfg.size, cfg.size)
  for (const stop of cfg.gradient) gradient.addColorStop(stop.offset, stop.color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, cfg.size, cfg.size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

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
  if (b.object3d?.fbxUrl || b.object3d?.gltfUrl || b.object3d?.glbUrl || b.object3d?.imageUrl) {
    delete object3d.primitive
  }
  return {
    ...a,
    ...b,
    object3d,
  }
}

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

async function loadProcessLabelFonts(settings) {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  try {
    await document.fonts.ready
  } catch (_) {
    /* ignore */
  }
  const families = new Set()
  const addStack = (stack) => {
    for (const f of extractQuotedFontFamilies(stack)) families.add(f)
  }
  addStack(settings?.defaultLabel?.fontFamily)
  addStack(settings?.defaultLabel?.subtitleFontFamily)
  for (const c of settings?.cubes ?? []) {
    addStack(c?.label?.fontFamily)
    addStack(c?.label?.subtitleFontFamily)
  }
  const mainW = String(settings?.defaultLabel?.fontWeight ?? '400').trim() || '400'
  const subW = String(
    settings?.defaultLabel?.subtitleFontWeight ?? settings?.defaultLabel?.fontWeight ?? '400',
  ).trim() || '400'
  const pxMain = 360
  const pxSub = Math.round(pxMain * 0.42)
  const sampleText = 'Думаем Собираем Плавим Утяжеляем ABCDEFG'
  const loads = []
  for (const fam of families) {
    loads.push(document.fonts.load(`${mainW} ${pxMain}px '${fam}'`, sampleText).catch(() => {}))
    loads.push(document.fonts.load(`${subW} ${pxSub}px '${fam}'`, sampleText).catch(() => {}))
  }
  await Promise.all(loads)
}

const PLATE_SCALE = (2 / 3) * 1.2
const CUBE_WIDTH = 4.5 * PLATE_SCALE
const CUBE_HEIGHT = 3.3 * PLATE_SCALE
const CUBE_DEPTH = 0.375 * PLATE_SCALE
const CUBE_GAP = 1.35 * PLATE_SCALE
const COMBAT_STRIDE = CUBE_HEIGHT + CUBE_GAP

const PLATE_BEVEL_RADIUS = 0.105 * PLATE_SCALE
const PLATE_BEVEL_SEGMENTS = 6
const FRAME_RAIL = 0.08 * PLATE_SCALE
const FRAME_OUTSET = 0.06 * PLATE_SCALE
const FRAME_BEVEL_RADIUS = 0.042 * PLATE_SCALE
const FRAME_BEVEL_SEGMENTS = 4

const MAX_WOBBLE_TILT_RAD = THREE.MathUtils.degToRad(10)
const WOBBLE_SPEED_MIN = 0.3
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

function measureLineHeight(ctx, text, fontPx, weight, family) {
  ctx.font = `${weight} ${fontPx}px ${family}`
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent ?? fontPx * 0.72
  const desc = m.actualBoundingBoxDescent ?? fontPx * 0.28
  return asc + desc
}

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
  const cw = Math.min(maxCanvasSide, Math.max(256, Math.round(planeW * pixelsPerUnit)))
  const ch = Math.max(64, Math.round(cw * (planeH / planeW)))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, cw, ch)

  const colorNum = mergedLabel.color !== undefined ? mergedLabel.color : 0x121418
  const hex = `#${(colorNum >>> 0).toString(16).padStart(6, '0')}`
  const subColorNum = mergedLabel.subtitleColor !== undefined ? mergedLabel.subtitleColor : colorNum
  const subHex = `#${(subColorNum >>> 0).toString(16).padStart(6, '0')}`

  const setMainFont = (px) => { ctx.font = `${fontWeight} ${px}px ${fontFamily}` }
  const setSubFont = (px) => { ctx.font = `${subWeight} ${px}px ${subFamily}` }

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

function buildPlateWithBezel(plateMat, mergedLabel, opts = {}) {
  const lowDetail = opts.lowDetail === true
  const plateSeg = lowDetail ? 3 : PLATE_BEVEL_SEGMENTS
  const frameSeg = lowDetail ? 2 : FRAME_BEVEL_SEGMENTS
  const tile = new THREE.Group()
  const plateGeom = new RoundedBoxGeometry(
    CUBE_WIDTH,
    CUBE_HEIGHT,
    CUBE_DEPTH,
    plateSeg,
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
    { geom: new RoundedBoxGeometry(CUBE_WIDTH, FRAME_RAIL, FRAME_OUTSET, frameSeg, FRAME_BEVEL_RADIUS), pos: [0, CUBE_HEIGHT * 0.5 - FRAME_RAIL * 0.5, zc] },
    { geom: new RoundedBoxGeometry(CUBE_WIDTH, FRAME_RAIL, FRAME_OUTSET, frameSeg, FRAME_BEVEL_RADIUS), pos: [0, -CUBE_HEIGHT * 0.5 + FRAME_RAIL * 0.5, zc] },
    { geom: new RoundedBoxGeometry(FRAME_RAIL, innerH, FRAME_OUTSET, frameSeg, FRAME_BEVEL_RADIUS), pos: [-CUBE_WIDTH * 0.5 + FRAME_RAIL * 0.5, 0, zc] },
    { geom: new RoundedBoxGeometry(FRAME_RAIL, innerH, FRAME_OUTSET, frameSeg, FRAME_BEVEL_RADIUS), pos: [CUBE_WIDTH * 0.5 - FRAME_RAIL * 0.5, 0, zc] },
  ]
  for (const { geom, pos } of segments) {
    const rail = new THREE.Mesh(geom, frameMat)
    rail.position.set(pos[0], pos[1], pos[2])
    tile.add(rail)
  }
  const labelMesh = createFlatLabelPlane(plateMat, mergedLabel)
  if (labelMesh) tile.add(labelMesh)
  for (const deco of createPlateFigureObjects(plateMat, mergedLabel, {
    plateScale: PLATE_SCALE,
    cubeDepth: CUBE_DEPTH,
    three: THREE,
  })) {
    tile.add(deco)
  }
  return tile
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

export default function WorkflowSection() {
  const containerRef = useRef(null)
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    setSceneReady(false)
    const container = containerRef.current
    if (!container) return undefined

    let renderer
    let scene
    let camera
    let controls
    let renderPipeline
    let resizeObserver
    let environmentTarget
    let noiseTexture3D
    let volumetricMesh
    const cubes = []
    const pointLights = []
    const pointLightMotion = []
    let spotLight
    let spotColorMap
    let cancelled = false

    const mobile = isWorkflowMobileProfile()
    const volumetricEnabled = !(mobile && WORKFLOW_DISABLE_VOLUMETRIC_ON_MOBILE)
    /** Упрощения плашек / shadow map — только если на мобильном ещё включён volumetric. */
    const reduceMobilePlateQuality = mobile && volumetricEnabled
    const volumetricSource = !volumetricEnabled
      ? WORKFLOW_VOLUMETRIC_SETTINGS
      : mobile
        ? deepMergeWorkflowConfig(WORKFLOW_VOLUMETRIC_SETTINGS, WORKFLOW_VOLUMETRIC_MOBILE_OVERRIDES)
        : WORKFLOW_VOLUMETRIC_SETTINGS
    const V = resolveWorkflowVolumetricSettings(volumetricSource)

    const onResize = () => {
      if (!renderer || !camera || !container) return
      const width = container.clientWidth
      const height = Math.max(container.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, V.renderer.maxPixelRatio))
    }

    void (async () => {
      renderer = new THREE.WebGPURenderer({ antialias: V.renderer.antialias })
      try {
        await renderer.init()
      } catch (error) {
        console.error('Workflow WebGPU init failed:', error)
        renderer?.dispose()
        return
      }
      if (cancelled) return

      renderer.setSize(container.clientWidth, Math.max(container.clientHeight, 1))
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, V.renderer.maxPixelRatio))
      renderer.toneMapping = V.renderer.toneMapping
      renderer.toneMappingExposure = V.renderer.toneMappingExposure
      renderer.shadowMap.enabled = V.renderer.shadowMapEnabled
      renderer.shadowMap.type = V.renderer.shadowMapType
      container.appendChild(renderer.domElement)
      if (!cancelled) setSceneReady(true)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / Math.max(container.clientHeight, 1),
        0.1,
        100,
      )
      camera.position.set(0, 0, 21)
      camera.lookAt(0, 0, 0)

      const envCfg = processDefaults.environment ?? {}
      const roomBlurSigma = envCfg.roomBlurSigma ?? 0.04
      const environmentIntensity = envCfg.intensity ?? 1
      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      const roomEnvironment = new RoomEnvironment()
      environmentTarget = pmremGenerator.fromScene(roomEnvironment, roomBlurSigma)
      scene.environment = environmentTarget.texture
      scene.environmentIntensity = environmentIntensity
      pmremGenerator.dispose()

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableRotate = true
      controls.enableZoom = true
      controls.enablePan = false
      controls.minDistance = 8
      controls.maxDistance = 40

      let volumetricMaterial = null
      if (volumetricEnabled) {
        noiseTexture3D = createTexture3D(V.noiseTexture3D)
        const smokeAmount = uniform(V.volume.smokeAmount)
        const ts = V.volume.timeScroll

        volumetricMaterial = new THREE.VolumeNodeMaterial()
        volumetricMaterial.steps = V.volume.rayMarchSteps
        volumetricMaterial.offsetNode = bayer16(screenCoordinate)
        volumetricMaterial.scatteringNode = Fn(({ positionRay }) => {
          const timeScaled = vec3(time.mul(ts.x), ts.y, time.mul(ts.z))
          const samples = V.volume.grainSamples
          const sampleGrain = (scale, timeScale = 1) =>
            texture3D(noiseTexture3D, positionRay.add(timeScaled.mul(timeScale)).mul(scale).mod(1), 0).r.add(0.5)
          let density = sampleGrain(samples[0].scale, samples[0].timeScale)
          for (let g = 1; g < samples.length; g += 1) {
            density = density.mul(sampleGrain(samples[g].scale, samples[g].timeScale))
          }
          return mix(1, density, smokeAmount)
        })

        const box = V.volumetricBox
        volumetricMesh = new THREE.Mesh(
          new THREE.BoxGeometry(box.width, box.height, box.depth),
          volumetricMaterial,
        )
        volumetricMesh.receiveShadow = box.receiveShadow
        volumetricMesh.position.y = box.positionY
        volumetricMesh.layers.disableAll()
        volumetricMesh.layers.enable(V.layerIndex)
        scene.add(volumetricMesh)
      } else {
        noiseTexture3D = null
        volumetricMesh = null
      }

      const cubeSpecs = processDefaults.cubes ?? []
      await loadProcessLabelFonts(processDefaults)
      const cubeCount = cubeSpecs.length
      const totalHeight = (cubeCount - 1) * COMBAT_STRIDE
      const topY = totalHeight / 2
      const introCfg = processDefaults.introTrain ?? {}
      let introPhase = 'done'
      let introElapsed = 0
      const plateFbxJobs = []
      const plateGltfJobs = []
      const plateImageJobs = []
      const figureScaleCtx = { plateScale: PLATE_SCALE, cubeDepth: CUBE_DEPTH, three: THREE }
      for (let i = 0; i < cubeCount; i += 1) {
        const spec = cubeSpecs[i] ?? {}
        const matOpts = mergeMaterialOptions(processDefaults.defaultMaterial, spec.material ?? {})
        const globalProc = processDefaults.procedural ?? {}
        const cubeProc = spec.procedural
        const procOn =
          globalProc.enabled !== false && (cubeProc === undefined || cubeProc.enabled !== false)
        let proceduralDispose = null
        if (procOn) {
          const presets = globalProc.presetsByIndex ?? ['copper', 'lead', 'aluminum', 'bronze']
          const preset = (cubeProc && cubeProc.preset) ?? presets[i % presets.length] ?? 'copper'
          const seed = (cubeProc && typeof cubeProc.seed === 'number' ? cubeProc.seed : i * 7919 + 1337)
          const uv = globalProc.uvRepeat ?? [3.5, 3.5]
          const uvU = (cubeProc && cubeProc.uvRepeat && cubeProc.uvRepeat[0]) ?? uv[0]
          const uvV = (cubeProc && cubeProc.uvRepeat && cubeProc.uvRepeat[1]) ?? uv[1]
          const maps = createMetalProceduralMaps(preset, seed, { uvRepeatU: uvU, uvRepeatV: uvV })
          Object.assign(matOpts, maps.textures)
          matOpts.normalScale = maps.normalScale
          proceduralDispose = maps.dispose
        }
        const mat = new THREE.MeshStandardMaterial(matOpts)
        const mergedLabel = mergeProcessLabel(processDefaults.defaultLabel, spec.label)
        const labelForBuild = reduceMobilePlateQuality
          ? {
              ...mergedLabel,
              maxCanvasSide: Math.min(mergedLabel.maxCanvasSide ?? 2048, 1024),
              pixelsPerUnit: Math.min(mergedLabel.pixelsPerUnit ?? 180, 128),
            }
          : mergedLabel
        const tile = buildPlateWithBezel(mat, labelForBuild, { lowDetail: reduceMobilePlateQuality })
        tile.userData.proceduralDispose = proceduralDispose
        const restY = topY - i * COMBAT_STRIDE
        tile.userData.restY = restY
        tile.position.set(0, restY, 0)
        const TAU = Math.PI * 2
        const randSpeed = () => WOBBLE_SPEED_MIN + Math.random() * (WOBBLE_SPEED_MAX - WOBBLE_SPEED_MIN)
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
        const od = mergedLabel?.object3d
        if (od?.fbxUrl && od.enabled !== false) {
          plateFbxJobs.push({ tile, object3d: od })
        }
        if ((od?.gltfUrl ?? od?.glbUrl) && od.enabled !== false) {
          plateGltfJobs.push({ tile, object3d: od })
        }
        if (od?.imageUrl && od.enabled !== false) {
          plateImageJobs.push({ tile, object3d: od })
        }
      }

      for (const job of plateFbxJobs) {
        if (cancelled) break
        try {
          await appendFbxPlateDeco(job.tile, job.object3d, figureScaleCtx)
        } catch (err) {
          console.error('WorkflowSection: plate FBX failed', job.object3d?.fbxUrl, err)
        }
      }

      for (const job of plateGltfJobs) {
        if (cancelled) break
        try {
          await appendGltfPlateDeco(job.tile, job.object3d, figureScaleCtx)
        } catch (err) {
          console.error(
            'WorkflowSection: plate glTF failed',
            job.object3d?.gltfUrl ?? job.object3d?.glbUrl,
            err,
          )
        }
      }

      for (const job of plateImageJobs) {
        if (cancelled) break
        try {
          await appendPlateImageDeco(job.tile, job.object3d, figureScaleCtx)
        } catch (err) {
          console.error('WorkflowSection: plate image failed', job.object3d?.imageUrl, err)
        }
      }

      const halfFovTanFrame = Math.tan(camera.fov * 0.5 * (Math.PI / 180))
      const halfCubeHFrame = CUBE_HEIGHT / 2
      const viewHFrame = 2 * Math.abs(camera.position.z) * halfFovTanFrame
      const minYFrame = -viewHFrame / 2 + halfCubeHFrame
      const bottomEdgeY = minYFrame - halfCubeHFrame
      const margin = introCfg.startBelowMargin ?? 1.2
      const introFlyEnabled = introCfg.enabled !== false && introCfg.flyEnabled !== false
      if (introFlyEnabled && cubeCount > 0) {
        const flyOrder = introCfg.flyOrder === 'bottom-first' ? 'bottom-first' : 'top-first'
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
        }
        const blank = introCfg.introBlankSeconds ?? 0.18
        const stagger = Math.max(0, introCfg.staggerBetweenPlatesSec ?? 0.4)
        const plateDur = Math.max(0.12, introCfg.plateFlyDurationSec ?? 1.1)
        for (let seq = 0; seq < order.length; seq += 1) {
          const i = order[seq]
          const cube = cubes[i]
          const t0 = blank + seq * stagger
          const t1 = t0 + plateDur
          cube.userData.introFlyT0 = t0
          cube.userData.introFlyT1 = t1
          cube.userData.introFlyStartY = cube.position.y
        }
        introPhase = 'fly'
        introElapsed = 0
      }

      const pointLightConfigs = Array.isArray(WORKFLOW_LIGHT_SETTINGS.pointLights)
        ? WORKFLOW_LIGHT_SETTINGS.pointLights
        : WORKFLOW_LIGHT_SETTINGS.pointLight
          ? [WORKFLOW_LIGHT_SETTINGS.pointLight]
          : []
      const mobileShadowMapSize = WORKFLOW_LIGHT_SETTINGS.mobileShadowMapSize ?? 256
      for (const cfg of pointLightConfigs) {
        const pointLight = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance)
        pointLight.position.set(...cfg.initialPosition)
        pointLight.castShadow = cfg.castShadow ?? false
        if (reduceMobilePlateQuality && pointLight.castShadow) {
          pointLight.shadow.mapSize.set(mobileShadowMapSize, mobileShadowMapSize)
        }
        pointLight.layers.enable(V.layerIndex)
        scene.add(pointLight)
        pointLights.push(pointLight)
        pointLightMotion.push({
          base: new THREE.Vector3(...cfg.initialPosition),
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          phaseZ: Math.random() * Math.PI * 2,
          speedX: 0.45 + Math.random() * 0.35,
          speedY: 0.35 + Math.random() * 0.3,
          speedZ: 0.4 + Math.random() * 0.35,
          ampX: 0.22 + Math.random() * 0.1,
          ampY: 0.14 + Math.random() * 0.08,
          ampZ: 0.2 + Math.random() * 0.1,
        })
      }

      spotLight = new THREE.SpotLight(
        WORKFLOW_LIGHT_SETTINGS.spotLight.color,
        WORKFLOW_LIGHT_SETTINGS.spotLight.intensity,
      )
      spotLight.position.set(...WORKFLOW_LIGHT_SETTINGS.spotLight.restPosition)
      spotLight.angle = WORKFLOW_LIGHT_SETTINGS.spotLight.angle
      spotLight.penumbra = WORKFLOW_LIGHT_SETTINGS.spotLight.penumbra
      spotLight.decay = WORKFLOW_LIGHT_SETTINGS.spotLight.decay
      spotLight.distance = WORKFLOW_LIGHT_SETTINGS.spotLight.distance
      spotLight.castShadow = WORKFLOW_LIGHT_SETTINGS.spotLight.castShadow
      if (reduceMobilePlateQuality && spotLight.castShadow) {
        spotLight.shadow.mapSize.set(mobileShadowMapSize, mobileShadowMapSize)
      }
      spotLight.layers.enable(V.layerIndex)
      const spotMapCfg = reduceMobilePlateQuality
        ? {
            ...WORKFLOW_LIGHT_SETTINGS.spotColorMap,
            size: Math.min(WORKFLOW_LIGHT_SETTINGS.spotColorMap?.size ?? 256, 128),
          }
        : WORKFLOW_LIGHT_SETTINGS.spotColorMap
      spotColorMap = createSpotColorMap(spotMapCfg) || undefined
      spotLight.map = spotColorMap
      scene.add(spotLight)
      scene.add(spotLight.target)

      renderPipeline = new THREE.RenderPipeline(renderer)
      if (volumetricEnabled) {
        const scenePass = pass(scene, camera)
        const sceneDepth = scenePass.getTextureNode('depth')
        volumetricMaterial.depthNode = sceneDepth.sample(screenUV)
        const volumetricLayer = new THREE.Layers()
        volumetricLayer.disableAll()
        volumetricLayer.enable(V.layerIndex)
        const volumetricPass = pass(scene, camera, { depthBuffer: V.postProcessing.volumetricPassDepthBuffer })
        volumetricPass.name = 'Workflow volumetric'
        volumetricPass.setLayers(volumetricLayer)
        volumetricPass.setResolutionScale(V.postProcessing.volumetricResolutionScale)
        const denoiseStrength = uniform(V.postProcessing.denoiseStrength)
        const blurredVolumetricPass = gaussianBlur(volumetricPass, denoiseStrength)
        const volumetricLightingIntensity = uniform(V.postProcessing.volumetricLightingIntensity)
        renderPipeline.outputNode = add(scenePass, mul(blurredVolumetricPass, volumetricLightingIntensity))
      } else {
        renderPipeline.outputNode = pass(scene, camera)
      }

      const clock = new THREE.Clock()
      spotLight.target.position.set(...WORKFLOW_LIGHT_SETTINGS.spotLight.target)
      renderer.setAnimationLoop(() => {
        const dt = clock.getDelta()
        const t = clock.elapsedTime
        for (let i = 0; i < pointLights.length; i += 1) {
          const motion = pointLightMotion[i]
          if (!motion) continue
          pointLights[i].position.set(
            motion.base.x + Math.sin(t * motion.speedX + motion.phaseX) * motion.ampX,
            motion.base.y + Math.cos(t * motion.speedY + motion.phaseY) * motion.ampY,
            motion.base.z + Math.sin(t * motion.speedZ + motion.phaseZ) * motion.ampZ,
          )
        }
        spotLight.position.set(...WORKFLOW_LIGHT_SETTINGS.spotLight.restPosition)
        spotLight.lookAt(
          spotLight.target.position.x,
          spotLight.target.position.y,
          spotLight.target.position.z,
        )

        if (introPhase === 'fly') {
          introElapsed += dt
          const introFlyEasePow = Math.max(1.1, introCfg.easePower ?? 2.35)
          for (const cube of cubes) {
            const t0 = cube.userData.introFlyT0 ?? 0
            const t1 = cube.userData.introFlyT1 ?? 0
            const y0 = cube.userData.introFlyStartY ?? cube.userData.restY
            const y1 = cube.userData.restY
            if (introElapsed < t0) {
              cube.position.y = y0
            } else if (introElapsed >= t1) {
              cube.position.y = y1
            } else {
              const span = Math.max(1e-5, t1 - t0)
              const u = (introElapsed - t0) / span
              const eased = 1 - (1 - u) ** introFlyEasePow
              cube.position.y = THREE.MathUtils.lerp(y0, y1, eased)
            }
          }
          const allLanded = cubes.every((c) => introElapsed >= (c.userData.introFlyT1 ?? 0))
          if (allLanded) introPhase = 'done'
        }

        applyPlateWobble(cubes, t)
        controls.update()
        renderPipeline.render()
      })

      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(container)
      window.addEventListener('resize', onResize)
    })()

    return () => {
      cancelled = true
      setSceneReady(false)
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      if (renderer) {
        renderer.setAnimationLoop(null)
        controls?.dispose()
        renderPipeline?.dispose()
        if (scene) scene.environment = null
        environmentTarget?.dispose()
        noiseTexture3D?.dispose()
        spotColorMap?.dispose()
        volumetricMesh?.geometry?.dispose()
        volumetricMesh?.material?.dispose()
        for (const cube of cubes) disposeTileResources(cube)
        renderer.dispose()
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <section id="workflow" className="relative h-svh w-full bg-black">
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{ touchAction: 'none' }}
      />
      <SectionSplashOverlay splash={WORKFLOW_SECTION_SPLASH} visible={!sceneReady} />
      <ProcessSectionTextOverlay
        items={(processDefaults.textOverlays ?? []).map((entry) => ({
          ...entry,
          hideAfterSec: null,
        }))}
        itemDefaults={PROCESS_TEXT_OVERLAY_ITEM_DEFAULTS}
        sceneReady={sceneReady}
        fadeTransitions={processDefaults.fadeTransitions ?? true}
      />
    </section>
  )
}
