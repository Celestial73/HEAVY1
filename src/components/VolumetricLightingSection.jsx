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

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/volumetricLightingSettings.js', (mod) => {
      setSettings(mod.VOLUMETRIC_LIGHTING_SETTINGS)
    })
    return undefined
  }, [])

  useEffect(() => {
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

      const tp = S.teapot
      const teapot = new THREE.Mesh(
        new TeapotGeometry(tp.size, tp.segments),
        new THREE.MeshStandardMaterial({ color: tp.color, side: tp.side }),
      )
      teapot.castShadow = tp.castShadow
      scene.add(teapot)

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

      const dragState = {
        isDown: false,
        pointerId: null,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        targetVelocityX: 0,
        targetVelocityY: 0,
        targetVelocityZ: 0,
        pendingDX: 0,
        pendingDY: 0,
        autoRotationY: 0,
        sceneTime: 0,
        speedMultiplier: motion.idleSpeed,
      }

      const onPointerDown = (event) => {
        if (!interaction.enableDragRotate) return
        dragState.isDown = true
        dragState.pointerId = event.pointerId
        dragState.pendingDX = 0
        dragState.pendingDY = 0
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }

      const onPointerMove = (event) => {
        if (!dragState.isDown || dragState.pointerId !== event.pointerId) return
        dragState.pendingDX += event.movementX || 0
        dragState.pendingDY += event.movementY || 0
      }

      const releaseDrag = (event) => {
        if (dragState.pointerId !== event.pointerId) return
        dragState.isDown = false
        dragState.pointerId = null
        try {
          renderer.domElement.releasePointerCapture?.(event.pointerId)
        } catch {
          /* noop */
        }
      }

      if (interaction.enableDragRotate) {
        renderer.domElement.style.cursor = 'grab'
        renderer.domElement.addEventListener('pointerdown', onPointerDown)
        renderer.domElement.addEventListener('pointermove', onPointerMove)
        renderer.domElement.addEventListener('pointerup', releaseDrag)
        renderer.domElement.addEventListener('pointercancel', releaseDrag)
        renderer.domElement.addEventListener('pointerleave', releaseDrag)
      }

      renderer.setAnimationLoop(() => {
        const delta = clock.getDelta()
        const angularSpeed = Math.hypot(
          dragState.velocityX,
          dragState.velocityY,
          dragState.velocityZ,
        )
        let targetMultiplier
        if (motion.drivenByInteraction) {
          const activity = dragState.isDown
            ? 1
            : Math.min(1, angularSpeed / Math.max(motion.activityThreshold, 1e-5))
          targetMultiplier =
            motion.idleSpeed + (motion.activeSpeed - motion.idleSpeed) * activity
        } else {
          targetMultiplier = 1
        }

        const ramping = targetMultiplier > dragState.speedMultiplier
          ? motion.rampUpTime
          : motion.rampDownTime
        const smoothing =
          ramping > 0 ? 1 - Math.exp(-delta / ramping) : 1
        dragState.speedMultiplier +=
          (targetMultiplier - dragState.speedMultiplier) * smoothing

        dragState.sceneTime += delta * dragState.speedMultiplier
        const t = dragState.sceneTime
        const scale = anim.orbitScale
        const p = anim.pointLight

        pointLight.position.x = Math.sin(t * p.speedX) * scale
        pointLight.position.y = Math.cos(t * p.speedY) * scale
        pointLight.position.z = Math.cos(t * p.speedZ) * scale

        spotLight.position.x = Math.cos(t * anim.spotLight.speedX) * scale
        spotLight.position.y = sl.restPosition[1]
        spotLight.position.z = sl.restPosition[2]
        spotLight.lookAt(0, 0, 0)

        dragState.autoRotationY += anim.teapotRotationY * delta
        if (anim.teapotRotationY !== 0) {
          teapot.rotation.y = dragState.autoRotationY
        }

        if (interaction.enableDragRotate) {
          const sx = interaction.dragSensitivityX
          const sy = interaction.dragSensitivityY
          const sz = interaction.dragSensitivityZ

          if (dragState.isDown && delta > 1e-5) {
            const dx = dragState.pendingDX
            const dy = dragState.pendingDY
            dragState.targetVelocityY = (dx * sy) / delta
            dragState.targetVelocityX = (dy * sx) / delta
            dragState.targetVelocityZ = ((dx + dy) * sz) / delta
          } else if (!dragState.isDown) {
            dragState.targetVelocityX = 0
            dragState.targetVelocityY = 0
            dragState.targetVelocityZ = 0
          }
          dragState.pendingDX = 0
          dragState.pendingDY = 0

          const approach = (current, target) => {
            const speeding = Math.abs(target) > Math.abs(current)
            const time = speeding
              ? interaction.accelerationTime
              : interaction.decelerationTime
            const smooth = time > 0 ? 1 - Math.exp(-delta / time) : 1
            return current + (target - current) * smooth
          }

          dragState.velocityX = approach(dragState.velocityX, dragState.targetVelocityX)
          dragState.velocityY = approach(dragState.velocityY, dragState.targetVelocityY)
          dragState.velocityZ = approach(dragState.velocityZ, dragState.targetVelocityZ)

          if (Math.abs(dragState.velocityX) < interaction.minAngularVelocity) dragState.velocityX = 0
          if (Math.abs(dragState.velocityY) < interaction.minAngularVelocity) dragState.velocityY = 0
          if (Math.abs(dragState.velocityZ) < interaction.minAngularVelocity) dragState.velocityZ = 0

          teapot.rotateY(dragState.velocityY * delta)
          teapot.rotateX(dragState.velocityX * delta)
          teapot.rotateZ(dragState.velocityZ * delta)
        }

        controls.update()
        renderPipeline.render()
      })

      resizeObserver = new ResizeObserver(onWindowResize)
      resizeObserver.observe(container)
      window.addEventListener('resize', onWindowResize)
    })()

    return () => {
      cancelled = true
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
    />
  )
}
