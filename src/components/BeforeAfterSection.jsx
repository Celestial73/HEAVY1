import { animated, useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { beforeAfterImage } from '../content/landingContent'

function DraggableCard({ title, heavy = false }) {
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }))

  const bind = useDrag(({ down, movement: [mx, my] }) => {
    const max = 52
    const clampX = Math.max(Math.min(mx, max), -max)
    const clampY = Math.max(Math.min(my, max), -max)
    api.start({
      x: down ? clampX : 0,
      y: down ? clampY : 0,
      config: heavy
        ? { mass: 7, tension: 180, friction: 44 }
        : { mass: 1.1, tension: 420, friction: 20 },
    })
  })

  return (
    <article className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4 shadow-heavy">
      <h3 className="mb-4 text-center text-xl font-bold text-white">{title}</h3>
      <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800 to-zinc-900">
        <animated.img
          {...bind()}
          src={beforeAfterImage}
          alt="Шокированная женщина"
          className="absolute left-1/2 top-1/2 h-40 w-40 touch-none select-none object-contain"
          style={{
            x,
            y,
            translateX: '-50%',
            translateY: '-50%',
            willChange: 'transform',
          }}
          draggable={false}
        />
      </div>
    </article>
  )
}

export default function BeforeAfterSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">До/после</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DraggableCard title="До" />
        <DraggableCard title="После" heavy />
      </div>
    </section>
  )
}
