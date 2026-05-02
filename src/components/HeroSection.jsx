import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, MeshDistortMaterial, Stars } from '@react-three/drei'
import { EffectComposer, GodRays } from '@react-three/postprocessing'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { PCFShadowMap, Vector3 } from 'three'

const CUBE_SETTINGS = {
  size: 0.5,
  startPosition: [0, 4.2, 0],
  rigidBody: {
    friction: 1.4,
    restitution: 0.02,
    linearDamping: 2.6,
    angularDamping: 30,
    mass: 1000,
  },
  material: {
    color: '#cfd6df',
    metalness: 0.92,
    roughness: 0.2,
    distort: 0.16,
    speed: 0.45,
  },
}

const SCENE_SETTINGS = {
  camera: { position: [4, 6, 7], fov: 45, near: 0.1, far: 120 },
  gravity: {
    default: [0, -16, 0],
    quiet: [0, 0, 0],
  },
  floor: {
    size: 40,
    thickness: 0.08,
    color: '#5c5c5c',
    metalness: 0.08,
    roughness: 0.95,
    opacity: 0.12,
  },
  stars: {
    radius: 180,
    depth: 80,
    factor: 4,
    saturation: 0,
    speed: 0.35,
    count: {
      low: 1400,
      medium: 2600,
      high: 5000,
    },
  },
  grid: {
    size: 40,
    divisions: {
      low: 100,
      medium: 100,
      high: 100,
    },
    majorColor: '#9ca3af',
    minorColor: '#374151',
  },
  environment: {
    preset: 'warehouse',
    intensity: 0.35,
  },
  fog: {
    color: '#1a2233',
    density: 0.04,
  },
  spotlight: {
    position: [0, 10, 0],
    target: [0, 0, 0],
    intensity: 1600,
    angle: 0.12,
    penumbra: 0.25,
    distance: 20,
    decay: 2,
    shadowMapSize: 1024,
    shadowBias: -0.00015,
  },
}

const DRAG_SETTINGS = {
  torqueScale: 0.00075,
  rollFactor: 0.45,
  groundedCenterY: 0.34,
  airborneCenterY: 0.95,
  groundedMultiplier: 2.6,
  airborneMultiplier: 0.42,
}

function useResponsiveSceneProfile() {
  const [profile, setProfile] = useState('medium')
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const updateSettings = () => {
      const width = window.innerWidth
      const dpr = window.devicePixelRatio || 1

      if (width < 640 || dpr > 2.2) {
        setProfile('low')
      } else if (width < 1024 || dpr > 1.5) {
        setProfile('medium')
      } else {
        setProfile('high')
      }

      setReducedMotion(mediaQuery.matches)
    }

    updateSettings()
    mediaQuery.addEventListener('change', updateSettings)
    window.addEventListener('resize', updateSettings)

    return () => {
      mediaQuery.removeEventListener('change', updateSettings)
      window.removeEventListener('resize', updateSettings)
    }
  }, [])

  return { profile, reducedMotion }
}

function HeavyCube({ reducedMotion }) {
  const cubeRef = useRef(null)
  const isDraggingRef = useRef(false)

  const materialSettings = useMemo(() => {
    if (!reducedMotion) return CUBE_SETTINGS.material

    return {
      ...CUBE_SETTINGS.material,
      distort: 0,
      speed: 0,
    }
  }, [reducedMotion])

  const handlePointerDown = (event) => {
    isDraggingRef.current = true
    event.stopPropagation()
    event.target.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event) => {
    isDraggingRef.current = false
    event.stopPropagation()
    event.target.releasePointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!isDraggingRef.current || !cubeRef.current || reducedMotion) return

    const body = cubeRef.current
    const pointerEvent = event.nativeEvent
    const moveX = pointerEvent.movementX || 0
    const moveY = pointerEvent.movementY || 0
    const centerY = body.translation().y
    const blendRange = DRAG_SETTINGS.airborneCenterY - DRAG_SETTINGS.groundedCenterY
    const blend = Math.min(
      1,
      Math.max(0, (centerY - DRAG_SETTINGS.groundedCenterY) / blendRange),
    )
    const stateMultiplier =
      DRAG_SETTINGS.groundedMultiplier +
      (DRAG_SETTINGS.airborneMultiplier - DRAG_SETTINGS.groundedMultiplier) * blend
    const torqueScale = DRAG_SETTINGS.torqueScale * stateMultiplier
    const torque = {
      x: moveY * torqueScale,
      y: -moveX * torqueScale,
      z: -(moveX + moveY) * torqueScale * DRAG_SETTINGS.rollFactor,
    }

    body.wakeUp()
    body.applyTorqueImpulse(torque, true)
    event.stopPropagation()
  }

  return (
    <RigidBody
      ref={cubeRef}
      position={CUBE_SETTINGS.startPosition}
      type={reducedMotion ? 'fixed' : 'dynamic'}
      colliders={false}
      enabledRotations={[true, true, true]}
      friction={CUBE_SETTINGS.rigidBody.friction}
      restitution={CUBE_SETTINGS.rigidBody.restitution}
      linearDamping={CUBE_SETTINGS.rigidBody.linearDamping}
      angularDamping={CUBE_SETTINGS.rigidBody.angularDamping}
      mass={CUBE_SETTINGS.rigidBody.mass}
      ccd
    >
      <CuboidCollider
        args={[
          CUBE_SETTINGS.size / 2,
          CUBE_SETTINGS.size / 2,
          CUBE_SETTINGS.size / 2,
        ]}
      />
      <mesh
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <boxGeometry
          args={[
            CUBE_SETTINGS.size,
            CUBE_SETTINGS.size,
            CUBE_SETTINGS.size,
          ]}
        />
        <MeshDistortMaterial
          color={materialSettings.color}
          metalness={materialSettings.metalness}
          roughness={materialSettings.roughness}
          distort={materialSettings.distort}
          speed={materialSettings.speed}
        />
      </mesh>
    </RigidBody>
  )
}

function CinematicGodRays() {
  const sunRef = useRef(null)
  const { camera } = useThree()
  const forwardRef = useRef(new Vector3())
  const upOffsetRef = useRef(new Vector3(0, 1.5, 0))

  useFrame(() => {
    if (!sunRef.current) return
    const forward = camera.getWorldDirection(forwardRef.current).multiplyScalar(18)
    sunRef.current.position.copy(camera.position).add(forward).add(upOffsetRef.current)
  })

  return (
    <>
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.8, 24, 24]} />
        <meshBasicMaterial color="#f3f7ff" toneMapped={false} transparent opacity={0.02} depthWrite={false} />
      </mesh>
      <EffectComposer multisampling={1}>
        <GodRays
          sun={sunRef}
          samples={120}
          density={0.97}
          decay={0.95}
          weight={1}
          exposure={0.9}
          clampMax={2}
          blur
        />
      </EffectComposer>
    </>
  )
}

export default function HeroSection() {
  const { profile, reducedMotion } = useResponsiveSceneProfile()

  const starsCount = SCENE_SETTINGS.stars.count[profile]
  const gridDivisions = SCENE_SETTINGS.grid.divisions[profile]
  const gravity = reducedMotion ? SCENE_SETTINGS.gravity.quiet : SCENE_SETTINGS.gravity.default
  const starsSpeed = reducedMotion ? 0 : SCENE_SETTINGS.stars.speed

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <Canvas
        shadows={{ type: PCFShadowMap }}
        camera={SCENE_SETTINGS.camera}
        className="absolute inset-0 h-full w-full touch-none"
      >
        <color attach="background" args={['#05070f']} />
        <fogExp2 attach="fog" args={[SCENE_SETTINGS.fog.color, SCENE_SETTINGS.fog.density]} />
        <ambientLight intensity={0.22} />
        <hemisphereLight intensity={0.35} groundColor="#3a1111" color="#e5eefc" />
        <directionalLight position={[2.5, 3, 2]} intensity={0.45} />
        <directionalLight position={[0, 8, 0]} intensity={1} />
        <directionalLight position={[3.4, 3, 4.8]} intensity={4} color="#bcd7ff" />
        <spotLight
          position={SCENE_SETTINGS.spotlight.position}
          target-position={SCENE_SETTINGS.spotlight.target}
          intensity={SCENE_SETTINGS.spotlight.intensity}
          angle={SCENE_SETTINGS.spotlight.angle}
          penumbra={SCENE_SETTINGS.spotlight.penumbra}
          distance={SCENE_SETTINGS.spotlight.distance}
          decay={SCENE_SETTINGS.spotlight.decay}
          castShadow
          shadow-mapSize-width={SCENE_SETTINGS.spotlight.shadowMapSize}
          shadow-mapSize-height={SCENE_SETTINGS.spotlight.shadowMapSize}
          shadow-bias={SCENE_SETTINGS.spotlight.shadowBias}
        />
        <CinematicGodRays />
        <Environment
          preset={SCENE_SETTINGS.environment.preset}
          environmentIntensity={SCENE_SETTINGS.environment.intensity}
        />
        <Stars
          radius={SCENE_SETTINGS.stars.radius}
          depth={SCENE_SETTINGS.stars.depth}
          count={starsCount}
          factor={SCENE_SETTINGS.stars.factor * 0.6}
          saturation={SCENE_SETTINGS.stars.saturation}
          fade
          speed={starsSpeed}
        />
        <gridHelper
          args={[SCENE_SETTINGS.grid.size, gridDivisions, SCENE_SETTINGS.grid.majorColor, SCENE_SETTINGS.grid.minorColor]}
          position={[0, 0, 0]}
        />
        <Physics gravity={gravity}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[SCENE_SETTINGS.floor.size / 2, SCENE_SETTINGS.floor.thickness, SCENE_SETTINGS.floor.size / 2]}
              position={[0, -SCENE_SETTINGS.floor.thickness, 0]}
              friction={1}
              restitution={0}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
              <planeGeometry args={[SCENE_SETTINGS.floor.size, SCENE_SETTINGS.floor.size]} />
              <meshStandardMaterial
                color={SCENE_SETTINGS.floor.color}
                metalness={SCENE_SETTINGS.floor.metalness}
                roughness={SCENE_SETTINGS.floor.roughness}
                transparent
                opacity={SCENE_SETTINGS.floor.opacity}
              />
            </mesh>
          </RigidBody>

          <HeavyCube reducedMotion={reducedMotion} />
        </Physics>
      </Canvas>
    </div>
  )
}
