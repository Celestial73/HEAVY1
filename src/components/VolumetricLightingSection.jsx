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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js'
import { bayer16 } from 'three/addons/tsl/math/Bayer.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { VOLUMETRIC_LIGHTING_SETTINGS as volumetricLightingDefaults } from '../config/volumetricLightingSettings.js'
import { VOLUMETRIC_SECTION_SPLASH } from '../config/sectionSplashSettings.js'
import {
  attachHitboxDebugHelper,
  createPlacementAreaDebugHelper,
  placeSpinnableMesh,
  selectSpinnablesForScene,
} from '../utils/spinnablePlacement.js'
import NextNavLink from './NextNavLink'
import SectionSplashOverlay from './SectionSplashOverlay.jsx'

function createTexture3D(cfg) {
  const {
    size,
    perlinScale,
    repeatFactor,
    format,
    minFilter,
    magFilter,
    wrapS,
    wrapT,
    unpackAlignment,
  } = cfg

  let i = 0
  const data = new Uint8Array(size * size * size)
  const perlin = new ImprovedNoise()

  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x / size) * repeatFactor
        const ny = (y / size) * repeatFactor
        const nz = (z / size) * repeatFactor
        const noiseValue = perlin.noise(nx * perlinScale, ny * perlinScale, nz * perlinScale)
        data[i] = 128 + 128 * noiseValue
        i += 1
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, size, size, size)
  texture.format = format
  texture.minFilter = minFilter
  texture.magFilter = magFilter
  texture.wrapS = wrapS
  texture.wrapT = wrapT
  texture.unpackAlignment = unpackAlignment
  texture.needsUpdate = true
  return texture
}

function resolveMaterialSide(side) {
  if (side === 'double') return THREE.DoubleSide
  if (side === 'back') return THREE.BackSide
  return THREE.FrontSide
}

function createSpinnableMesh(cfg) {
  const a = cfg.args || {}
  let geometry
  switch (cfg.type) {
    case 'teapot':
      geometry = new TeapotGeometry(a.size ?? 0.8, a.segments ?? 18)
      break
    case 'box':
      geometry = new THREE.BoxGeometry(a.width ?? 1, a.height ?? 1, a.depth ?? 1)
      break
    case 'sphere':
      geometry = new THREE.SphereGeometry(
        a.radius ?? 0.5,
        a.widthSegments ?? 32,
        a.heightSegments ?? 16,
      )
      break
    case 'icosahedron':
      geometry = new THREE.IcosahedronGeometry(a.radius ?? 0.5, a.detail ?? 0)
      break
    case 'torus':
      geometry = new THREE.TorusGeometry(
        a.radius ?? 0.4,
        a.tube ?? 0.15,
        a.radialSegments ?? 12,
        a.tubularSegments ?? 48,
      )
      break
    case 'torusKnot':
      geometry = new THREE.TorusKnotGeometry(
        a.radius ?? 0.4,
        a.tube ?? 0.13,
        a.tubularSegments ?? 96,
        a.radialSegments ?? 12,
      )
      break
    case 'cone':
      geometry = new THREE.ConeGeometry(
        a.radius ?? 0.5,
        a.height ?? 1,
        a.segments ?? 32,
      )
      break
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        a.radiusTop ?? 0.5,
        a.radiusBottom ?? 0.5,
        a.height ?? 1,
        a.segments ?? 32,
      )
      break
    default:
      throw new Error(`Unknown spinnable type: ${cfg.type}`)
  }

  const m = cfg.material || {}
  const material = new THREE.MeshStandardMaterial({
    color: m.color ?? 0xffffff,
    roughness: m.roughness ?? 0.5,
    metalness: m.metalness ?? 0,
    side: resolveMaterialSide(m.side),
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = cfg.castShadow ?? true
  mesh.receiveShadow = cfg.receiveShadow ?? false
  return mesh
}

function resolvePublicAssetUrl(url) {
  if (!url) return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url

  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

async function createSpinnableObject(cfg) {
  if (cfg.type === 'gltf' || cfg.type === 'glb') {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(resolvePublicAssetUrl(cfg.gltfUrl))
    const root = gltf.scene
    if (typeof cfg.gltfScale === 'number') root.scale.setScalar(cfg.gltfScale)
    root.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = cfg.castShadow ?? true
      o.receiveShadow = cfg.receiveShadow ?? false
    })
    return root
  }

  if (cfg.type !== 'obj') return createSpinnableMesh(cfg)

  const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
    import('three/addons/loaders/OBJLoader.js'),
    import('three/addons/loaders/MTLLoader.js'),
  ])
  const loader = new OBJLoader()
  if (cfg.mtlUrl) {
    const mtlLoader = new MTLLoader()
    const materials = await mtlLoader.loadAsync(resolvePublicAssetUrl(cfg.mtlUrl))
    materials.preload()
    loader.setMaterials(materials)
  }
  const root = await loader.loadAsync(resolvePublicAssetUrl(cfg.objUrl))
  const m = cfg.material || {}
  const textureLoader = new THREE.TextureLoader()
  const usePbrTextures =
    cfg.textureSet?.enabled &&
    cfg.textureSet?.folder &&
    cfg.textureSet?.prefix &&
    Array.isArray(cfg.textureSet?.suffixes)

  const loadTextureMaybe = async (url, colorSpace) => {
    try {
      const tex = await textureLoader.loadAsync(url)
      if (colorSpace) tex.colorSpace = colorSpace
      return tex
    } catch {
      return null
    }
  }

  const toArray = (mat) => (Array.isArray(mat) ? mat : [mat]).filter(Boolean)
  const pbrCache = new Map()

  const applyToMaterial = async (material, materialName) => {
    if (!material) return
    if (m.side !== undefined && material.side !== undefined) material.side = resolveMaterialSide(m.side)
    if (m.color !== undefined && material.color) material.color.setHex(m.color)
    if (m.roughness !== undefined && material.roughness !== undefined) material.roughness = m.roughness
    if (m.metalness !== undefined && material.metalness !== undefined) material.metalness = m.metalness

    if (!usePbrTextures || !materialName) {
      material.needsUpdate = true
      return
    }

    if (!pbrCache.has(materialName)) {
      const [baseColorSuffix, normalSuffix, roughnessSuffix, metallicSuffix] = cfg.textureSet.suffixes
      const textureBase = `${resolvePublicAssetUrl(cfg.textureSet.folder)}/${cfg.textureSet.prefix}_${materialName}`
      const [map, normalMap, roughnessMap, metalnessMap] = await Promise.all([
        loadTextureMaybe(`${textureBase}_${baseColorSuffix}`, THREE.SRGBColorSpace),
        loadTextureMaybe(`${textureBase}_${normalSuffix}`),
        loadTextureMaybe(`${textureBase}_${roughnessSuffix}`),
        loadTextureMaybe(`${textureBase}_${metallicSuffix}`),
      ])
      pbrCache.set(materialName, { map, normalMap, roughnessMap, metalnessMap })
    }

    const texSet = pbrCache.get(materialName)
    if (texSet.map) material.map = texSet.map
    if (texSet.normalMap) material.normalMap = texSet.normalMap
    if (texSet.roughnessMap) material.roughnessMap = texSet.roughnessMap
    if (texSet.metalnessMap) material.metalnessMap = texSet.metalnessMap
    material.needsUpdate = true
  }

  const materialTasks = []
  root.traverse((o) => {
    if (!o.isMesh) return
    const mats = toArray(o.material)
    for (const mat of mats) {
      materialTasks.push(applyToMaterial(mat, mat.name || o.material?.name || o.name || ''))
    }
    o.castShadow = cfg.castShadow ?? true
    o.receiveShadow = cfg.receiveShadow ?? false
  })
  await Promise.all(materialTasks)

  if (typeof cfg.objScale === 'number') root.scale.setScalar(cfg.objScale)
  return root
}

function isObjectInsideRoot(object, root) {
  let cursor = object
  while (cursor) {
    if (cursor === root) return true
    cursor = cursor.parent
  }
  return false
}

function createSpotColorMap(cfg) {
  const canvas = document.createElement('canvas')
  canvas.width = cfg.size
  canvas.height = cfg.size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createLinearGradient(0, 0, cfg.size, cfg.size)
  for (const stop of cfg.gradient) {
    gradient.addColorStop(stop.offset, stop.color)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, cfg.size, cfg.size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export default function VolumetricLightingSection() {
  const containerRef = useRef(null)
  const [settings, setSettings] = useState(volumetricLightingDefaults)
  const [sceneReady, setSceneReady] = useState(false)
  const brandIntro = settings.overlay.brandIntro ?? {}
  const brandInitialDelay =
    typeof brandIntro.initialDelay === 'number' && Number.isFinite(brandIntro.initialDelay)
      ? brandIntro.initialDelay
      : 2
  const brandLineStagger =
    typeof brandIntro.lineStagger === 'number' && Number.isFinite(brandIntro.lineStagger)
      ? brandIntro.lineStagger
      : 0.3
  const splashBlocking =
    VOLUMETRIC_SECTION_SPLASH?.enabled !== false &&
    (!sceneReady || VOLUMETRIC_SECTION_SPLASH?.forceVisible === true)
  const contentAnimReady = sceneReady && !splashBlocking
  const controlsIntro = settings.overlay.controlsIntro ?? {}

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/volumetricLightingSettings.js', (mod) => {
      setSettings(mod.VOLUMETRIC_LIGHTING_SETTINGS)
    })
    return undefined
  }, [])

  useEffect(() => {
    setSceneReady(false)
    const S = settings
    const container = containerRef.current
    if (!container) return undefined

    let renderer
    let camera
    let controls
    let renderPipeline
    let resizeObserver
    let cancelled = false

    function onWindowResize() {
      if (!renderer || !container || !camera) return
      const width = container.clientWidth
      const height = Math.max(container.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, S.renderer.maxPixelRatio))
      renderer.setSize(width, height)
    }

    void (async () => {
      renderer = new THREE.WebGPURenderer({ antialias: S.renderer.antialias })
      try {
        await renderer.init()
      } catch (error) {
        console.error('WebGPURenderer init failed:', error)
        renderer?.dispose()
        return
      }

      if (cancelled) {
        renderer.dispose()
        return
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, S.renderer.maxPixelRatio))
      renderer.setSize(container.clientWidth, Math.max(container.clientHeight, 1))
      renderer.toneMapping = S.renderer.toneMapping
      renderer.toneMappingExposure = S.renderer.toneMappingExposure
      renderer.shadowMap.enabled = S.renderer.shadowMapEnabled
      renderer.shadowMap.type = S.renderer.shadowMapType

      container.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(
        S.camera.fov,
        container.clientWidth / Math.max(container.clientHeight, 1),
        S.camera.near,
        S.camera.far,
      )
      camera.position.set(...S.camera.position)

      let cameraPointLight = null
      const cameraLightOffset = new THREE.Vector3()
      const cpl = S.cameraPointLight
      if (cpl?.enabled !== false) {
        const offset = cpl.offset ?? [0, 2, 0]
        cameraLightOffset.set(offset[0], offset[1], offset[2])
        cameraPointLight = new THREE.PointLight(
          cpl.color ?? 0xffffff,
          cpl.intensity ?? 1,
          cpl.distance ?? 0,
        )
        cameraPointLight.castShadow = cpl.castShadow ?? false
        scene.add(cameraPointLight)
      }

      controls = new OrbitControls(camera, renderer.domElement)
      controls.minDistance = S.orbitControls.minDistance
      controls.maxDistance = S.orbitControls.maxDistance
      controls.enableRotate = S.orbitControls.enableRotate
      controls.enableZoom = S.orbitControls.enableZoom
      controls.enablePan = S.orbitControls.enablePan

      const noiseTexture3D = createTexture3D(S.noiseTexture3D)
      const smokeAmount = uniform(S.volume.smokeAmount)
      const ts = S.volume.timeScroll

      const volumetricMaterial = new THREE.VolumeNodeMaterial()
      volumetricMaterial.steps = S.volume.rayMarchSteps
      volumetricMaterial.offsetNode = bayer16(screenCoordinate)
      volumetricMaterial.scatteringNode = Fn(({ positionRay }) => {
        const timeScaled = vec3(time.mul(ts.x), ts.y, time.mul(ts.z))
        const samples = S.volume.grainSamples
        const sampleGrain = (scale, timeScale = 1) =>
          texture3D(
            noiseTexture3D,
            positionRay.add(timeScaled.mul(timeScale)).mul(scale).mod(1),
            0,
          ).r.add(0.5)

        let density = sampleGrain(samples[0].scale, samples[0].timeScale)
        for (let g = 1; g < samples.length; g += 1) {
          density = density.mul(sampleGrain(samples[g].scale, samples[g].timeScale))
        }
        return mix(1, density, smokeAmount)
      })

      const box = S.volumetricBox
      const volumetricMesh = new THREE.Mesh(
        new THREE.BoxGeometry(box.width, box.height, box.depth),
        volumetricMaterial,
      )
      volumetricMesh.receiveShadow = box.receiveShadow
      volumetricMesh.position.y = box.positionY
      volumetricMesh.layers.disableAll()
      volumetricMesh.layers.enable(S.layerIndex)
      scene.add(volumetricMesh)

      const placement = S.placement || { random: false }
      const physics = S.physics || { enabled: false }

      if (placement.showHitboxes) {
        const areaHelper = createPlacementAreaDebugHelper(placement, S.hitboxDebug)
        if (areaHelper) scene.add(areaHelper)
      }

      const placedHitboxes = []
      const spinnables = []
      const selectedSpinnables = selectSpinnablesForScene(S)
      for (const cfg of selectedSpinnables) {
        const mesh = await createSpinnableObject(cfg)
        const placed = placeSpinnableMesh(mesh, cfg, placement, placedHitboxes)

        mesh.position.set(placed.x, placed.y, placed.z)
        mesh.rotation.set(0, 0, 0)
        placedHitboxes.push(placed.worldBox)

        const visualRot = placed.visualRotation
        if (visualRot) {
          mesh.rotation.set(visualRot.x, visualRot.y, visualRot.z)
        }

        if (placement.showHitboxes) {
          attachHitboxDebugHelper(mesh, placed.halfExtents, S.hitboxDebug, placed.placementOk)
        }

        scene.add(mesh)

        const bounds = new THREE.Box3().setFromObject(mesh)
        const size = bounds.getSize(new THREE.Vector3())
        const radius = Math.max(0.1, size.length() * 0.5)

        const linearVelocity = new THREE.Vector3()
        if (physics.enabled) {
          const dir = new THREE.Vector3(
            Math.random() * 2 - 1,
            (Math.random() * 2 - 1) * (physics.initialUpwardJitter ?? 0),
            Math.random() * 2 - 1,
          )
          if (dir.lengthSq() === 0) dir.set(1, 0, 0)
          dir.normalize()
          const speed = THREE.MathUtils.lerp(
            physics.initialSpeedMin ?? 0,
            physics.initialSpeedMax ?? physics.initialSpeedMin ?? 0,
            Math.random(),
          )
          linearVelocity.copy(dir).multiplyScalar(speed)
        }

        spinnables.push({
          cfg,
          mesh,
          hitboxHalfExtents: placed.halfExtents,
          radius,
          linearVelocity,
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0,
          targetVelocityX: 0,
          targetVelocityY: 0,
          targetVelocityZ: 0,
          pendingDX: 0,
          pendingDY: 0,
        })
      }

      const fl = S.floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(fl.width, fl.height),
        new THREE.MeshStandardMaterial({ color: fl.color }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = fl.positionY
      floor.receiveShadow = fl.receiveShadow
      scene.add(floor)

      const pl = S.pointLight
      const pointLight = new THREE.PointLight(pl.color, pl.intensity, pl.distance)
      pointLight.castShadow = pl.castShadow
      pointLight.position.set(...pl.initialPosition)
      pointLight.layers.enable(S.layerIndex)
      scene.add(pointLight)

      const sl = S.spotLight
      const spotLight = new THREE.SpotLight(sl.color, sl.intensity)
      spotLight.position.set(...sl.restPosition)
      spotLight.angle = sl.angle
      spotLight.penumbra = sl.penumbra
      spotLight.decay = sl.decay
      spotLight.distance = sl.distance
      spotLight.map = createSpotColorMap(S.spotColorMap) || undefined
      spotLight.castShadow = sl.castShadow
      spotLight.shadow.intensity = sl.shadow.intensity
      spotLight.shadow.mapSize.width = sl.shadow.mapSize
      spotLight.shadow.mapSize.height = sl.shadow.mapSize
      spotLight.shadow.camera.near = sl.shadow.cameraNear
      spotLight.shadow.camera.far = sl.shadow.cameraFar
      spotLight.shadow.focus = sl.shadow.focus
      spotLight.layers.enable(S.layerIndex)
      scene.add(spotLight)
      scene.add(spotLight.target)

      renderPipeline = new THREE.RenderPipeline(renderer)

      const volumetricLightingIntensity = uniform(S.postProcessing.volumetricLightingIntensity)
      const volumetricLayer = new THREE.Layers()
      volumetricLayer.disableAll()
      volumetricLayer.enable(S.layerIndex)

      const scenePass = pass(scene, camera)
      const sceneDepth = scenePass.getTextureNode('depth')
      volumetricMaterial.depthNode = sceneDepth.sample(screenUV)

      const pp = S.postProcessing
      const volumetricPass = pass(scene, camera, { depthBuffer: pp.volumetricPassDepthBuffer })
      volumetricPass.name = pp.volumetricPassName
      volumetricPass.setLayers(volumetricLayer)
      volumetricPass.setResolutionScale(pp.volumetricResolutionScale)

      const denoiseStrength = uniform(pp.denoiseStrength)
      const blurredVolumetricPass = gaussianBlur(volumetricPass, denoiseStrength)
      renderPipeline.outputNode = add(
        scenePass,
        mul(blurredVolumetricPass, volumetricLightingIntensity),
      )

      const clock = new THREE.Clock()
      const anim = S.animation
      const interaction = S.interaction
      const motion = S.motion

      const sceneState = {
        sceneTime: 0,
        speedMultiplier: motion.idleSpeed,
      }

      const TAU = Math.PI * 2
      const pointPhase = anim.pointLight.randomizePhase
        ? {
            x: Math.random() * TAU,
            y: Math.random() * TAU,
            z: Math.random() * TAU,
          }
        : { x: 0, y: 0, z: 0 }
      const spotPhase = anim.spotLight.randomizePhase
        ? { x: Math.random() * TAU }
        : { x: 0 }

      const raycaster = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      let activeDrag = null

      const pickSpinnable = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null
        ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(ndc, camera)
        const meshes = spinnables.map((s) => s.mesh)
        const hit = raycaster.intersectObjects(meshes, true)[0]
        if (!hit) return null
        return spinnables.find((s) => isObjectInsideRoot(hit.object, s.mesh)) || null
      }

      const onPointerDown = (event) => {
        if (!interaction.enableDragRotate) return
        const target = pickSpinnable(event)
        if (!target) return
        activeDrag = { spinnable: target, pointerId: event.pointerId }
        target.pendingDX = 0
        target.pendingDY = 0
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }

      const onPointerMove = (event) => {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
          if (interaction.enableDragRotate && !activeDrag) {
            const hover = pickSpinnable(event)
            renderer.domElement.style.cursor = hover ? 'grab' : 'default'
          }
          return
        }
        activeDrag.spinnable.pendingDX += event.movementX || 0
        activeDrag.spinnable.pendingDY += event.movementY || 0
      }

      const releaseDrag = (event) => {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
        try {
          renderer.domElement.releasePointerCapture?.(event.pointerId)
        } catch {
          /* noop */
        }
        activeDrag = null
        renderer.domElement.style.cursor = 'default'
      }

      if (interaction.enableDragRotate) {
        renderer.domElement.style.cursor = 'default'
        renderer.domElement.addEventListener('pointerdown', onPointerDown)
        renderer.domElement.addEventListener('pointermove', onPointerMove)
        renderer.domElement.addEventListener('pointerup', releaseDrag)
        renderer.domElement.addEventListener('pointercancel', releaseDrag)
        renderer.domElement.addEventListener('pointerleave', releaseDrag)
      }

      const approachVelocity = (current, target, delta) => {
        const speeding = Math.abs(target) > Math.abs(current)
        const t = speeding ? interaction.accelerationTime : interaction.decelerationTime
        const smooth = t > 0 ? 1 - Math.exp(-delta / t) : 1
        return current + (target - current) * smooth
      }

      renderer.setAnimationLoop(() => {
        const delta = clock.getDelta()
        let totalAngularSpeed = 0

        if (interaction.enableDragRotate) {
          for (const s of spinnables) {
            const sens = s.cfg.sensitivity
            const sx = sens?.x ?? interaction.dragSensitivityX
            const sy = sens?.y ?? interaction.dragSensitivityY
            const sz = sens?.z ?? interaction.dragSensitivityZ
            const isActive = activeDrag?.spinnable === s

            if (isActive && delta > 1e-5) {
              const dx = s.pendingDX
              const dy = s.pendingDY
              s.targetVelocityY = (dx * sy) / delta
              s.targetVelocityX = (dy * sx) / delta
              // Крен вокруг Z считаем от диагонального жеста; разность dx/dy
              // даёт более стабильный twist, чем сумма (которая часто взаимно гасится).
              s.targetVelocityZ = ((dx - dy) * sz) / delta
            } else if (!isActive) {
              s.targetVelocityX = 0
              s.targetVelocityY = 0
              s.targetVelocityZ = 0
            }
            s.pendingDX = 0
            s.pendingDY = 0

            s.velocityX = approachVelocity(s.velocityX, s.targetVelocityX, delta)
            s.velocityY = approachVelocity(s.velocityY, s.targetVelocityY, delta)
            s.velocityZ = approachVelocity(s.velocityZ, s.targetVelocityZ, delta)

            if (Math.abs(s.velocityX) < interaction.minAngularVelocity) s.velocityX = 0
            if (Math.abs(s.velocityY) < interaction.minAngularVelocity) s.velocityY = 0
            if (Math.abs(s.velocityZ) < interaction.minAngularVelocity) s.velocityZ = 0

            s.mesh.rotateY(s.velocityY * delta)
            s.mesh.rotateX(s.velocityX * delta)
            s.mesh.rotateZ(s.velocityZ * delta)

            totalAngularSpeed += Math.hypot(s.velocityX, s.velocityY, s.velocityZ)
          }
        }

        if (physics.enabled) {
          const floorY = S.floor.positionY
          const damping = Math.pow(physics.airDamping ?? 1, delta)
          for (const s of spinnables) {
            const isHeld = activeDrag?.spinnable === s
            const v = s.linearVelocity

            if (isHeld) {
              v.set(0, 0, 0)
              continue
            }

            v.y += (physics.gravity ?? 0) * delta
            v.multiplyScalar(damping)

            s.mesh.position.x += v.x * delta
            s.mesh.position.y += v.y * delta
            s.mesh.position.z += v.z * delta

            const minY = floorY + s.radius + (physics.floorEpsilon ?? 0)
            if (s.mesh.position.y < minY) {
              s.mesh.position.y = minY
              if (v.y < 0) v.y = -v.y * (physics.floorRestitution ?? 0)
              v.x *= physics.floorFriction ?? 1
              v.z *= physics.floorFriction ?? 1
            }

            const min = physics.minLinearSpeed ?? 0
            if (Math.abs(v.x) < min) v.x = 0
            if (Math.abs(v.y) < min && s.mesh.position.y === minY) v.y = 0
            if (Math.abs(v.z) < min) v.z = 0
          }
        }

        let targetMultiplier
        if (motion.drivenByInteraction) {
          const activity = activeDrag
            ? 1
            : Math.min(1, totalAngularSpeed / Math.max(motion.activityThreshold, 1e-5))
          targetMultiplier =
            motion.idleSpeed + (motion.activeSpeed - motion.idleSpeed) * activity
        } else {
          targetMultiplier = 1
        }

        const ramping =
          targetMultiplier > sceneState.speedMultiplier
            ? motion.rampUpTime
            : motion.rampDownTime
        const smoothing = ramping > 0 ? 1 - Math.exp(-delta / ramping) : 1
        sceneState.speedMultiplier +=
          (targetMultiplier - sceneState.speedMultiplier) * smoothing

        sceneState.sceneTime += delta * sceneState.speedMultiplier
        const t = sceneState.sceneTime
        const scale = anim.orbitScale
        const p = anim.pointLight

        pointLight.position.x = Math.sin(t * p.speedX + pointPhase.x) * scale
        pointLight.position.y = Math.cos(t * p.speedY + pointPhase.y) * scale
        pointLight.position.z = Math.cos(t * p.speedZ + pointPhase.z) * scale

        const spotAnim = anim.spotLight
        const spotAngle = t * spotAnim.speed + spotPhase.x
        spotLight.position.x = Math.cos(spotAngle) * spotAnim.radius
        spotLight.position.y = spotAnim.height
        spotLight.position.z = Math.sin(spotAngle) * spotAnim.radius
        spotLight.lookAt(0, 0, 0)

        controls.update()

        if (cameraPointLight) {
          cameraPointLight.position.copy(cameraLightOffset).applyMatrix4(camera.matrixWorld)
        }

        renderPipeline.render()
      })

      if (!cancelled) setSceneReady(true)

      resizeObserver = new ResizeObserver(onWindowResize)
      resizeObserver.observe(container)
      window.addEventListener('resize', onWindowResize)
    })()

    return () => {
      cancelled = true
      setSceneReady(false)
      window.removeEventListener('resize', onWindowResize)
      resizeObserver?.disconnect()

      if (renderer) {
        renderer.setAnimationLoop(null)
        controls?.dispose()
        renderPipeline?.dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement)
        }
      }
    }
  }, [settings])

  return (
    <section
      ref={containerRef}
      className={settings.layout.sectionClassName}
      style={{ touchAction: settings.layout.touchAction }}
    >
      <SectionSplashOverlay splash={VOLUMETRIC_SECTION_SPLASH} visible={!sceneReady} />
      <div className="pointer-events-none fixed bottom-20 right-5 z-70 sm:bottom-21 sm:right-8">
        <button
          type="button"
          onClick={() => window.location.reload()}
          aria-label="Обновить страницу"
          style={
            contentAnimReady
              ? { animationDelay: `${controlsIntro.initialDelay ?? 0}s` }
              : undefined
          }
          className={`pointer-events-auto group inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-[0.98] ${contentAnimReady ? 'animate-fade-up' : 'opacity-0'}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180"
          >
            <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>

        <NextNavLink
          to={settings.overlay.nextLink.to}
          ariaLabel={settings.overlay.nextLink.ariaLabel}
          animateReady={contentAnimReady}
          style={{
            animationDelay: `${(controlsIntro.initialDelay ?? 0) + (controlsIntro.stagger ?? 0)}s`,
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: brandIntro.x ?? 'clamp(24px, 6vw, 96px)',
          top: brandIntro.y ?? 'clamp(80px, 12vh, 96px)',
          maxWidth: brandIntro.maxWidth ?? 'calc(100vw - clamp(48px, 12vw, 192px))',
        }}
      >
        <h1
          className="font-brand uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]"
          style={{ textAlign: brandIntro.textAlign ?? 'left' }}
        >
          <span
            className={`block tracking-[0.02em] text-transparent ${contentAnimReady ? 'animate-fade-up' : 'opacity-0'}`}
            style={{
              ...(contentAnimReady ? { animationDelay: `${brandInitialDelay}s` } : {}),
              fontSize: brandIntro.subtitleFontSize ?? 'clamp(3.75rem, 7vw, 14rem)',
              WebkitTextStroke: `${brandIntro.titleStrokeWidth ?? 'clamp(0.5px, 0.18vw, 1.5px)'} white`,
            }}
          >
            {brandIntro.subtitleText ?? 'Агентство'}
          </span>
          <span
            className={`block tracking-[0.01em] ${contentAnimReady ? 'animate-fade-up' : 'opacity-0'}`}
            style={{
              ...(contentAnimReady ? { animationDelay: `${brandInitialDelay + brandLineStagger}s` } : {}),
              fontSize: brandIntro.titleFontSize ?? 'clamp(4.5rem, 15vw, 15rem)',
            }}
          >
            {brandIntro.titleText ?? 'утяжеления'}
          </span>
        </h1>
      </div>
    </section>
  )
}
