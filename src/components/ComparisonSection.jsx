import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { COMPARISON_SECTION_SETTINGS as defaults } from '../config/comparisonSectionSettings.js'

function FeatherIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full text-white/85 drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]"
    >
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  )
}

function KettlebellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-full w-full text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
    >
      <path d="M9.2 3.4a2.8 2.8 0 0 1 5.6 0v.7a6.6 6.6 0 1 1-5.6 0v-.7zm1.6.4v1.7a.8.8 0 0 1-.45.72 5 5 0 1 0 3.3 0 .8.8 0 0 1-.45-.72V3.8a1.2 1.2 0 1 0-2.4 0z" />
    </svg>
  )
}

const ICON_REGISTRY = {
  feather: FeatherIcon,
  kettlebell: KettlebellIcon,
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function deriveParams(mass, physicsConfig, overrides = {}) {
  const m = Math.max(0.1, mass)
  const d = physicsConfig.derive
  const tension = d.dragSpring.tension
  const springFriction = 2 * d.dragSpring.dampingRatio * Math.sqrt(m * tension)
  return {
    mass: m,
    throwScale: d.throwScale.numerator / Math.sqrt(m),
    decay: clamp(d.decay.base + d.decay.slope * m, d.decay.min, d.decay.max),
    restitution: clamp(
      d.restitution.base + d.restitution.slope * m,
      d.restitution.min,
      d.restitution.max,
    ),
    /** Конфиг для react-spring во время удержания. Чем больше mass, тем больше отставание. */
    dragSpringConfig: { mass: m, tension, friction: springFriction },
    minSpeed: physicsConfig.minSpeed,
    maxStepDt: physicsConfig.maxStepDt,
    throwVelocityScale: physicsConfig.throwVelocityScale,
    ...overrides,
  }
}

/**
 * Перетаскиваемый объект с инерцией внутри треугольной половины.
 *
 * Удержание: позиция следует за указателем 1:1, на каждом шаге зажимается
 * в прямоугольник родителя и в треугольник по диагонали.
 * Отпускание: переключаемся на физический интегратор (RAF). Импульс
 * берётся из жеста, масштабируется по `throwScale`. Каждый кадр:
 * экспоненциальное трение, интеграция, кламп и отражение скорости от стенок.
 */
function DraggableObject({
  ariaLabel,
  boundsRef,
  side,
  initialLeftFrac,
  initialTopFrac,
  sizeClassName,
  mass,
  physicsConfig,
  physicsOverrides,
  children,
}) {
  const objRef = useRef(null)
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }))
  const physicsState = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const rafRef = useRef(null)

  const params = deriveParams(mass, physicsConfig, physicsOverrides)

  const clampToRect = (s, w, h, r, withReflect) => {
    const minX = -initialLeftFrac * w + r
    const maxX = (1 - initialLeftFrac) * w - r
    const minY = -initialTopFrac * h + r
    const maxY = (1 - initialTopFrac) * h - r

    if (s.x < minX) {
      s.x = minX
      if (withReflect && s.vx < 0) s.vx = -s.vx * params.restitution
    } else if (s.x > maxX) {
      s.x = maxX
      if (withReflect && s.vx > 0) s.vx = -s.vx * params.restitution
    }
    if (s.y < minY) {
      s.y = minY
      if (withReflect && s.vy < 0) s.vy = -s.vy * params.restitution
    } else if (s.y > maxY) {
      s.y = maxY
      if (withReflect && s.vy > 0) s.vy = -s.vy * params.restitution
    }
  }

  const clampToTriangle = (s, w, h, r, withReflect) => {
    const margin = r * Math.sqrt(1 / (w * w) + 1 / (h * h))
    const sumLimit = side === 'upper-left' ? 1 - margin : 1 + margin
    const sum = initialLeftFrac + s.x / w + initialTopFrac + s.y / h
    const violates = side === 'upper-left' ? sum > sumLimit : sum < sumLimit
    if (!violates) return

    const diff = side === 'upper-left' ? sum - sumLimit : sumLimit - sum
    const sign = side === 'upper-left' ? -1 : 1
    s.x += (sign * diff * w) / 2
    s.y += (sign * diff * h) / 2

    if (withReflect) {
      const L = Math.sqrt(w * w + h * h)
      const ns = side === 'upper-left' ? 1 : -1
      const nx = (ns * h) / L
      const ny = (ns * w) / L
      const dot = s.vx * nx + s.vy * ny
      if (dot > 0) {
        s.vx -= (1 + params.restitution) * dot * nx
        s.vy -= (1 + params.restitution) * dot * ny
      }
    }
  }

  const stopPhysics = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const startPhysics = () => {
    stopPhysics()
    let prev = performance.now()
    const tick = (now) => {
      const dt = Math.min(params.maxStepDt, (now - prev) / 1000)
      prev = now

      const parent = boundsRef.current
      const obj = objRef.current
      if (!parent || !obj) {
        rafRef.current = null
        return
      }

      const w = parent.offsetWidth
      const h = parent.offsetHeight
      const r = Math.max(obj.offsetWidth, obj.offsetHeight) / 2
      const s = physicsState.current

      const factor = Math.pow(params.decay, dt)
      s.vx *= factor
      s.vy *= factor

      s.x += s.vx * dt
      s.y += s.vy * dt

      clampToRect(s, w, h, r, true)
      clampToTriangle(s, w, h, r, true)

      api.start({ x: s.x, y: s.y, immediate: true })

      if (Math.hypot(s.vx, s.vy) < params.minSpeed) {
        s.vx = 0
        s.vy = 0
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => stopPhysics(), [])

  const bind = useDrag(
    ({ first, last, offset: [ox, oy], velocity, direction }) => {
      if (first) stopPhysics()

      const parent = boundsRef.current
      const obj = objRef.current
      const s = physicsState.current
      s.x = ox
      s.y = oy

      if (parent && obj) {
        const w = parent.offsetWidth
        const h = parent.offsetHeight
        const r = Math.max(obj.offsetWidth, obj.offsetHeight) / 2
        clampToRect(s, w, h, r, false)
        clampToTriangle(s, w, h, r, false)
      }

      if (last) {
        const scale = 1000 * params.throwVelocityScale * params.throwScale
        s.vx = velocity[0] * direction[0] * scale
        s.vy = velocity[1] * direction[1] * scale
        if (Math.hypot(s.vx, s.vy) >= params.minSpeed) {
          startPhysics()
        } else {
          // Импульса нет — даём пружине доехать до итоговой клампленной позиции.
          api.start({ x: s.x, y: s.y, config: params.dragSpringConfig })
        }
      } else {
        // Удержание: цель — клампленная позиция, пружина догоняет с массой и трением.
        api.start({ x: s.x, y: s.y, config: params.dragSpringConfig })
      }
    },
    {
      from: () => [x.get(), y.get()],
    },
  )

  return (
    <animated.div
      ref={objRef}
      {...bind()}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      style={{
        x,
        y,
        touchAction: 'none',
        left: `${initialLeftFrac * 100}%`,
        top: `${initialTopFrac * 100}%`,
      }}
      className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-grab select-none items-center justify-center will-change-transform active:cursor-grabbing ${sizeClassName}`}
    >
      {children}
    </animated.div>
  )
}

function ComparisonHalf({ halfKey, half, objects, physics, clipPath, boundsRef }) {
  const fallbackIcon = halfKey === 'before' ? FeatherIcon : KettlebellIcon
  return (
    <div
      ref={boundsRef}
      className={`absolute inset-0 ${half.backgroundClassName}`}
      style={{ clipPath }}
    >
      {objects
        .filter((o) => o.half === halfKey)
        .map((obj) => {
          const Icon = ICON_REGISTRY[obj.icon] ?? fallbackIcon
          return (
            <DraggableObject
              key={obj.id}
              ariaLabel={obj.ariaLabel}
              boundsRef={boundsRef}
              side={half.side}
              initialLeftFrac={obj.initial.leftFrac}
              initialTopFrac={obj.initial.topFrac}
              sizeClassName={obj.sizeClassName}
              mass={obj.mass}
              physicsConfig={physics}
              physicsOverrides={obj.physicsOverrides}
            >
              <Icon />
            </DraggableObject>
          )
        })}
    </div>
  )
}

function ComparisonCard({ settings }) {
  const { card, objects, physics } = settings
  const { halves, diagonal } = card

  const beforeRef = useRef(null)
  const afterRef = useRef(null)

  return (
    <article className={`${card.aspectClassName} ${card.className}`}>
      <ComparisonHalf
        halfKey="before"
        half={halves.before}
        objects={objects}
        physics={physics}
        clipPath={diagonal.beforeClipPath}
        boundsRef={beforeRef}
      />

      <ComparisonHalf
        halfKey="after"
        half={halves.after}
        objects={objects}
        physics={physics}
        clipPath={diagonal.afterClipPath}
        boundsRef={afterRef}
      />

      {diagonal.line.show && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1={diagonal.line.x1}
            y1={diagonal.line.y1}
            x2={diagonal.line.x2}
            y2={diagonal.line.y2}
            stroke={diagonal.line.stroke}
            strokeWidth={diagonal.line.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <span className={halves.before.label.className}>{halves.before.label.text}</span>
      <span className={halves.after.label.className}>{halves.after.label.text}</span>
    </article>
  )
}

export default function ComparisonSection() {
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/comparisonSectionSettings.js', (mod) => {
      if (mod?.COMPARISON_SECTION_SETTINGS) setSettings(mod.COMPARISON_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  const { layout, text, cta } = settings

  return (
    <section id={layout.sectionId} className={layout.sectionClassName}>
      <div className={layout.containerClassName}>
        <h2 className={text.titleClassName}>{text.title}</h2>

        <div className={`${layout.titleAfterClassName} ${text.paragraphsContainerClassName}`}>
          {text.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className={layout.cardSlotClassName}>
          <ComparisonCard settings={settings} />
        </div>

        <div className={layout.ctaSlotClassName}>
          <Link to={cta.to} aria-label={cta.ariaLabel} className={cta.className}>
            {cta.text}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
