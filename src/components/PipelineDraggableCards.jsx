import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMPARISON_SECTION_SETTINGS } from '../config/comparisonSectionSettings.js'
import PipelineCardRows from './PipelineCardRows.jsx'
import {
  PipelineCardOutline,
  PipelineRopePath,
  resolveCardOutlineConfig,
  resolveRopeConfig,
} from './PipelineCardChrome.jsx'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Те же формулы, что `deriveParams` в `ComparisonSection` (из `comparisonSectionSettings.physics`).
 * Масса 40 — как тяжёлый объект «После» (`after-vase`): слабый бросок, сильное трение, мягкий отскок.
 */
function derivePipelinePhysics(mass, physicsConfig = COMPARISON_SECTION_SETTINGS.physics) {
  const m = Math.max(0.1, mass)
  const d = physicsConfig.derive
  const exp = d.throwScale.massExponent ?? 0.5
  const throwScale = d.throwScale.numerator / Math.pow(m, exp)
  const decay = clamp(d.decay.base + d.decay.slope * m, d.decay.min, d.decay.max)
  const restitution = clamp(
    d.restitution.base + d.restitution.slope * m,
    d.restitution.min,
    d.restitution.max,
  )
  return {
    mass: m,
    throwScale,
    decay,
    restitution,
    minSpeed: physicsConfig.minSpeed,
    maxStepDt: physicsConfig.maxStepDt,
    throwVelocityScale: physicsConfig.throwVelocityScale,
  }
}

/** Как у тяжёлой картинки в Comparison (`mass: 40`). */
const PIPELINE_CARD_MASS = 40
const PHYS = derivePipelinePhysics(PIPELINE_CARD_MASS)

const ROPE_ITER_DRAG = 16
const ROPE_ITER_CHAIN = 12
const ROPE_STIFFNESS = 0.88
/** Ниже этого запаса по длине считаем «провисание» — не раздвигаем карточки. */
const ROPE_SLACK_EPS = 0.4

/** Удержание: разгон к цели курсора (пружина + демпфер), не мгновенный lerp. */
const DRAG_CHASE_STIFF = 20
const DRAG_CHASE_DAMP = 12
const DRAG_CHASE_ACCEL_CAP = 2200
const DRAG_CHASE_SPEED_CAP = 640

function anchorBottomWorld(layout, offsets, i) {
  const b = layout.bases[i]
  const w = layout.widths[i]
  const h = layout.heights[i]
  const o = offsets[i] ?? { x: 0, y: 0 }
  return { x: b.left + w / 2 + o.x, y: b.top + h + o.y }
}

function anchorTopWorld(layout, offsets, i) {
  const b = layout.bases[i]
  const w = layout.widths[i]
  const o = offsets[i] ?? { x: 0, y: 0 }
  return { x: b.left + w / 2 + o.x, y: b.top + o.y }
}

/** Длины верёвок в покое: максимум «провисания»; при большем расстоянии якоря стягиваются (см. `ROPE_SLACK_EPS`). */
function computeRestLengths(layout, n) {
  const zero = Array.from({ length: n }, () => ({ x: 0, y: 0 }))
  const rests = []
  for (let i = 0; i < n - 1; i += 1) {
    const A = anchorBottomWorld(layout, zero, i)
    const B = anchorTopWorld(layout, zero, i + 1)
    rests.push(Math.hypot(B.x - A.x, B.y - A.y))
  }
  return rests
}

/**
 * PBD только на **натяжение**: если якоря ближе, чем в покое — не трогаем (верёвка провисает);
 * если дальше — стягиваем к `restLengths[i]`.
 */
function solveRopeConstraints(layout, offsets, restLengths, pinnedIndex) {
  const n = offsets.length
  for (let iter = 0; iter < ROPE_ITER_DRAG; iter += 1) {
    for (let pass = 0; pass < 2; pass += 1) {
      const dir = pass === 0 ? 1 : -1
      const start = pass === 0 ? 0 : n - 2
      for (let k = start; pass === 0 ? k < n - 1 : k >= 0; k += dir) {
        const i = k
        const invA = i === pinnedIndex ? 0 : 1
        const invB = i + 1 === pinnedIndex ? 0 : 1
        const wSum = invA + invB
        if (wSum < 1e-9) continue

        const A = anchorBottomWorld(layout, offsets, i)
        const B = anchorTopWorld(layout, offsets, i + 1)
        const dx = B.x - A.x
        const dy = B.y - A.y
        const dist = Math.hypot(dx, dy) || 1e-9
        const L = restLengths[i] ?? dist
        const err = dist - L
        if (err <= ROPE_SLACK_EPS) continue
        const nx = dx / dist
        const ny = dy / dist
        const lambda = (err / wSum) * ROPE_STIFFNESS

        if (invA > 0) {
          offsets[i].x += nx * lambda * invA
          offsets[i].y += ny * lambda * invA
        }
        if (invB > 0) {
          offsets[i + 1].x -= nx * lambda * invB
          offsets[i + 1].y -= ny * lambda * invB
        }
      }
    }
  }
}

function clampCardOffset(off, bb, ww, hh, vw, vh, margin, restitution, vel) {
  const minX = margin - bb.left
  const maxX = vw - bb.left - ww - margin
  const minY = margin - bb.top
  const maxY = vh - bb.top - hh - margin

  if (off.x < minX) {
    off.x = minX
    if (vel && vel.vx < 0) vel.vx = -vel.vx * restitution
  } else if (off.x > maxX) {
    off.x = maxX
    if (vel && vel.vx > 0) vel.vx = -vel.vx * restitution
  }
  if (off.y < minY) {
    off.y = minY
    if (vel && vel.vy < 0) vel.vy = -vel.vy * restitution
  } else if (off.y > maxY) {
    off.y = maxY
    if (vel && vel.vy > 0) vel.vy = -vel.vy * restitution
  }
}

function cloneOffsets(arr) {
  return arr.map((o) => ({ x: o.x, y: o.y }))
}

/** `null` если не задано / не число. */
function readViewportPercent(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const LEN_TOKEN_RE = /^(-?\d*\.?\d+)\s*(px|vw|vh)$/i

/** Разбор одной длины для расчёта раскладки (без `%` и `rem`). */
function parseLengthTokenPx(raw, vw, vh) {
  const s = String(raw).trim()
  const m = s.match(LEN_TOKEN_RE)
  if (!m) return null
  const num = Number(m[1])
  if (!Number.isFinite(num)) return null
  const unit = m[2].toLowerCase()
  if (unit === 'px') return num
  if (unit === 'vw') return (num * vw) / 100
  if (unit === 'vh') return (num * vh) / 100
  return null
}

function splitTopLevelCommas(s) {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** `clamp(min, preferred, max)` — те же единицы, что `parseLengthTokenPx`. */
function evalClampToPx(str, vw, vh) {
  const t = String(str).trim()
  const m = t.match(/^clamp\s*\(\s*(.+)\s*\)$/i)
  if (!m) return null
  const parts = splitTopLevelCommas(m[1])
  if (parts.length !== 3) return null
  const a = parseLengthTokenPx(parts[0], vw, vh)
  const b = parseLengthTokenPx(parts[1], vw, vh)
  const c = parseLengthTokenPx(parts[2], vw, vh)
  if (a == null || b == null || c == null) return null
  const lo = Math.min(a, c)
  const hi = Math.max(a, c)
  return clamp(b, lo, hi)
}

/**
 * Число — px; строка — `clamp(...)`, либо одна длина `px`/`vw`/`vh` (как у fluid-текста).
 * Используется и для стиля карточки, и для верёвок / перетаскивания.
 */
function resolvePipelineCardSizePx(value, vw, vh, fallbackPx) {
  const fb = Math.max(32, Number(fallbackPx) || 120)
  if (value == null || value === '') return fb
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(32, value)
  const s = String(value).trim()
  if (/^[-+]?\d*\.?\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? Math.max(32, n) : fb
  }
  const fromClamp = evalClampToPx(s, vw, vh)
  if (fromClamp != null && Number.isFinite(fromClamp)) return Math.max(32, fromClamp)
  const single = parseLengthTokenPx(s, vw, vh)
  if (single != null && Number.isFinite(single)) return Math.max(32, single)
  return fb
}

function resolveCardHeightWidthRatio(card, globalRatio) {
  const g =
    typeof globalRatio === 'number' && Number.isFinite(globalRatio) && globalRatio > 0
      ? globalRatio
      : 0.5
  const r = card?.heightWidthRatio
  if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
  return g
}

/** Режим процентов: у каждой карточки заданы оба процента — иначе старая вертикальная колонка. */
function listUsesViewportPercentLayout(list) {
  if (!list.length) return false
  return list.every((c) => readViewportPercent(c?.initialXPercent) != null && readViewportPercent(c?.initialYPercent) != null)
}

/**
 * Настраиваемые прямоугольники: цепочка «верёвкой» между соседями, тянут друг друга;
 * инерция и тяжесть как в Comparison.
 */
export default function PipelineDraggableCards({
  cards,
  stageInsetPx = 24,
  bottomReservePx = 108,
  /** Дефолт высота/ширина; у карточки можно задать `heightWidthRatio`. */
  cardHeightWidthRatio = 0.5,
  cardRowDefaults,
  cardFadeTransitions = true,
  cardRowGapPx = 8,
  cardOutlineDefaults,
  ropeDefaults,
  ropesByIndex,
  chromeFadeTransitions = true,
}) {
  const list = useMemo(() => (Array.isArray(cards) ? cards.filter((c) => c && c.enabled !== false) : []), [cards])

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 400,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }))

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const layout = useMemo(() => {
    const n = list.length
    if (n === 0) return { bases: [], heights: [], widths: [] }

    const inset = typeof stageInsetPx === 'number' ? stageInsetPx : 24
    const reserve = typeof bottomReservePx === 'number' ? bottomReservePx : 108
    const vw = viewport.w
    const vh = viewport.h
    const widths = list.map((c) => resolvePipelineCardSizePx(c.widthPx, vw, vh, 160))
    const hwRatioBase =
      typeof cardHeightWidthRatio === 'number' &&
      Number.isFinite(cardHeightWidthRatio) &&
      cardHeightWidthRatio > 0
        ? cardHeightWidthRatio
        : 0.5
    const heights = widths.map((w, i) =>
      Math.max(32, w * resolveCardHeightWidthRatio(list[i], hwRatioBase)),
    )
    const margin = 4

    const bases = []

    if (listUsesViewportPercentLayout(list)) {
      for (let i = 0; i < n; i += 1) {
        const w = widths[i]
        const h = heights[i]
        const xPct = readViewportPercent(list[i].initialXPercent)
        const yPct = readViewportPercent(list[i].initialYPercent)
        const cx = (vw * clamp(xPct, 0, 100)) / 100
        const cy = (vh * clamp(yPct, 0, 100)) / 100
        let left = cx - w / 2
        let top = cy - h / 2
        const maxTop = vh - reserve - h - margin
        left = clamp(left, margin, vw - w - margin)
        top = clamp(top, margin, maxTop)
        bases.push({ left, top })
      }
    } else {
      const sumH = heights.reduce((a, b) => a + b, 0)
      const H = Math.max(0, vh - inset - reserve - inset)
      const gapCount = n + 1
      const gap = Math.max(6, (H - sumH) / gapCount)
      let y = inset + gap
      for (let i = 0; i < n; i += 1) {
        const w = widths[i]
        const left = (vw - w) / 2
        bases.push({ left, top: y })
        y += heights[i] + gap
      }
    }

    return { bases, heights, widths }
  }, [list, viewport.w, viewport.h, stageInsetPx, bottomReservePx, cardHeightWidthRatio])

  const layoutRef = useRef(layout)
  const viewportRef = useRef(viewport)
  useEffect(() => {
    layoutRef.current = layout
    viewportRef.current = viewport
  }, [layout, viewport])

  const restLengths = useMemo(() => {
    const n = layout.bases.length
    if (n < 2) return []
    return computeRestLengths(layout, n)
  }, [layout])

  const restLengthsRef = useRef(restLengths)
  useEffect(() => {
    restLengthsRef.current = restLengths
  }, [restLengths])

  const [offsets, setOffsets] = useState(() => list.map(() => ({ x: 0, y: 0 })))
  const offsetsRef = useRef(offsets)
  useEffect(() => {
    offsetsRef.current = offsets
  }, [offsets])

  useEffect(() => {
    setOffsets(list.map(() => ({ x: 0, y: 0 })))
  }, [list])

  const dragRef = useRef(null)
  const dragLoopRafRef = useRef(null)
  const chainRafRef = useRef(null)
  const chainVelRef = useRef(null)

  const stopChainPhysics = useCallback(() => {
    if (chainRafRef.current != null) {
      cancelAnimationFrame(chainRafRef.current)
      chainRafRef.current = null
    }
    chainVelRef.current = null
  }, [])

  useEffect(
    () => () => {
      stopChainPhysics()
      if (dragLoopRafRef.current != null) {
        cancelAnimationFrame(dragLoopRafRef.current)
        dragLoopRafRef.current = null
      }
    },
    [stopChainPhysics],
  )

  const stopDragLoop = useCallback(() => {
    if (dragLoopRafRef.current != null) {
      cancelAnimationFrame(dragLoopRafRef.current)
      dragLoopRafRef.current = null
    }
  }, [])

  const clampAllOffsets = useCallback((offs, vels) => {
    const lay = layoutRef.current
    const { w: vw, h: vh } = viewportRef.current
    const margin = 4
    const n = offs.length
    for (let i = 0; i < n; i += 1) {
      const bb = lay.bases[i]
      const ww = lay.widths[i]
      const hh = lay.heights[i]
      if (!bb || ww == null || hh == null) continue
      const vel = vels ? vels[i] : null
      clampCardOffset(offs[i], bb, ww, hh, vw, vh, margin, PHYS.restitution, vel)
    }
  }, [])

  const startChainPhysics = useCallback(
    (primaryIndex, x0, y0, vx0, vy0) => {
      stopChainPhysics()
      const lay = layoutRef.current
      const n = lay.bases.length
      if (n === 0) return

      const vels = Array.from({ length: n }, () => ({ vx: 0, vy: 0 }))
      vels[primaryIndex] = { vx: vx0, vy: vy0 }
      chainVelRef.current = vels

      const offs = cloneOffsets(offsetsRef.current)
      if (offs[primaryIndex]) {
        offs[primaryIndex].x = x0
        offs[primaryIndex].y = y0
      }

      let prev = performance.now()

      const tick = (now) => {
        const v = chainVelRef.current
        if (!v) return

        const dt = Math.min(PHYS.maxStepDt, (now - prev) / 1000)
        prev = now
        const layout0 = layoutRef.current
        const rests = restLengthsRef.current
        const n0 = layout0.bases.length
        if (n0 === 0) {
          stopChainPhysics()
          return
        }

        const factor = Math.pow(PHYS.decay, dt)
        for (let i = 0; i < n0; i += 1) {
          v[i].vx *= factor
          v[i].vy *= factor
        }

        for (let i = 0; i < n0; i += 1) {
          offs[i].x += v[i].vx * dt
          offs[i].y += v[i].vy * dt
        }

        for (let it = 0; it < ROPE_ITER_CHAIN; it += 1) {
          for (let pass = 0; pass < 2; pass += 1) {
            const dir = pass === 0 ? 1 : -1
            const start = pass === 0 ? 0 : n0 - 2
            for (let k = start; pass === 0 ? k < n0 - 1 : k >= 0; k += dir) {
              const i = k
              const invA = 1
              const invB = 1
              const wSum = invA + invB
              const A = anchorBottomWorld(layout0, offs, i)
              const B = anchorTopWorld(layout0, offs, i + 1)
              const dx = B.x - A.x
              const dy = B.y - A.y
              const dist = Math.hypot(dx, dy) || 1e-9
              const L = rests[i] ?? dist
              const err = dist - L
              if (err <= ROPE_SLACK_EPS) continue
              const nx = dx / dist
              const ny = dy / dist
              const lambda = (err / wSum) * ROPE_STIFFNESS
              offs[i].x += nx * lambda * invA
              offs[i].y += ny * lambda * invA
              offs[i + 1].x -= nx * lambda * invB
              offs[i + 1].y -= ny * lambda * invB
            }
          }
        }

        clampAllOffsets(offs, v)

        setOffsets(cloneOffsets(offs))

        let anyFast = false
        for (let i = 0; i < n0; i += 1) {
          if (Math.hypot(v[i].vx, v[i].vy) >= PHYS.minSpeed) {
            anyFast = true
            break
          }
        }
        if (!anyFast) {
          stopChainPhysics()
          return
        }

        chainRafRef.current = requestAnimationFrame(tick)
      }

      setOffsets(cloneOffsets(offs))
      chainRafRef.current = requestAnimationFrame(tick)
    },
    [clampAllOffsets, stopChainPhysics],
  )

  const onPointerDown = useCallback(
    (e, index) => {
      if (e.button !== 0) return
      const b = layout.bases[index]
      const w = layout.widths[index]
      if (!b) return

      stopDragLoop()
      stopChainPhysics()

      const startX = e.clientX
      const startY = e.clientY
      const orig = offsetsRef.current[index] ?? { x: 0, y: 0 }
      const t0 = performance.now()
      const massNorm = clamp((PIPELINE_CARD_MASS - 0.4) / (40 - 0.4), 0, 1)

      dragRef.current = {
        index,
        startX,
        startY,
        origX: orig.x,
        origY: orig.y,
        w,
        lastT: t0,
        smoothX: orig.x,
        smoothY: orig.y,
        lastX: orig.x,
        lastY: orig.y,
        pointerX: e.clientX,
        pointerY: e.clientY,
        vx: 0,
        vy: 0,
        emaVx: 0,
        emaVy: 0,
      }

      const runDragStep = () => {
        const d = dragRef.current
        if (!d) return
        const layM = layoutRef.current
        const vp = viewportRef.current
        const bb = layM.bases[d.index]
        const ww = layM.widths[d.index]
        const hh = layM.heights[d.index]
        if (!bb || ww == null || hh == null) return
        const margin = 4
        let tx = d.origX + (d.pointerX - d.startX)
        let ty = d.origY + (d.pointerY - d.startY)
        tx = clamp(tx, margin - bb.left, vp.w - bb.left - ww - margin)
        ty = clamp(ty, margin - bb.top, vp.h - bb.top - hh - margin)

        const now = performance.now()
        const dt = clamp((now - d.lastT) / 1000, 1e-4, 0.05)
        d.lastT = now

        const ex = tx - d.smoothX
        const ey = ty - d.smoothY
        const stiff = DRAG_CHASE_STIFF * (0.42 + 0.58 * (1 - massNorm))
        const damp = DRAG_CHASE_DAMP * (0.5 + 0.5 * (1 - massNorm))
        let ax = stiff * ex - damp * d.vx
        let ay = stiff * ey - damp * d.vy
        const aMag = Math.hypot(ax, ay)
        if (aMag > DRAG_CHASE_ACCEL_CAP) {
          const s = DRAG_CHASE_ACCEL_CAP / aMag
          ax *= s
          ay *= s
        }
        d.vx += ax * dt
        d.vy += ay * dt
        const vMag = Math.hypot(d.vx, d.vy)
        if (vMag > DRAG_CHASE_SPEED_CAP) {
          const s = DRAG_CHASE_SPEED_CAP / vMag
          d.vx *= s
          d.vy *= s
        }
        d.smoothX += d.vx * dt
        d.smoothY += d.vy * dt

        const dtMs = Math.max(1e-3, dt * 1000)
        const instVx = ((d.smoothX - d.lastX) / dtMs) * 1000
        const instVy = ((d.smoothY - d.lastY) / dtMs) * 1000
        const alpha = 0.2 + 0.12 * (1 - massNorm)
        d.emaVx = d.emaVx * (1 - alpha) + instVx * alpha
        d.emaVy = d.emaVy * (1 - alpha) + instVy * alpha
        d.lastX = d.smoothX
        d.lastY = d.smoothY

        const sx = d.smoothX
        const sy = d.smoothY

        const next = cloneOffsets(offsetsRef.current)
        next[d.index] = { x: sx, y: sy }
        const rests = restLengthsRef.current
        if (rests.length > 0) {
          solveRopeConstraints(layoutRef.current, next, rests, d.index)
        }
        clampAllOffsets(next, null)
        setOffsets(next)
      }

      const dragTick = () => {
        if (!dragRef.current) {
          dragLoopRafRef.current = null
          return
        }
        runDragStep()
        dragLoopRafRef.current = requestAnimationFrame(dragTick)
      }
      dragLoopRafRef.current = requestAnimationFrame(dragTick)

      const move = (ev) => {
        const d = dragRef.current
        if (!d) return
        d.pointerX = ev.clientX
        d.pointerY = ev.clientY
      }

      const up = () => {
        stopDragLoop()
        const d = dragRef.current
        dragRef.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)

        if (!d) return

        const gestureScale = 1000 * PHYS.throwVelocityScale * PHYS.throwScale
        const springVx = d.emaVx * 0.28 + d.vx * 0.58
        const springVy = d.emaVy * 0.28 + d.vy * 0.58
        const gestureVx = d.emaVx * gestureScale * 0.001
        const gestureVy = d.emaVy * gestureScale * 0.001
        let vx = springVx * massNorm + gestureVx * (1 - massNorm)
        let vy = springVy * massNorm + gestureVy * (1 - massNorm)

        const cap = 1200
        const mag = Math.hypot(vx, vy)
        if (mag > cap) {
          vx = (vx / mag) * cap
          vy = (vy / mag) * cap
        }

        if (Math.hypot(vx, vy) >= PHYS.minSpeed) {
          startChainPhysics(d.index, d.lastX, d.lastY, vx, vy)
        }
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      e.preventDefault()
    },
    [startChainPhysics, stopChainPhysics, stopDragLoop, clampAllOffsets],
  )

  const n = list.length
  if (n === 0) return null

  const ropePaths = []
  if (restLengths.length > 0) {
    for (let i = 0; i < n - 1; i += 1) {
      const b0 = layout.bases[i]
      const b1 = layout.bases[i + 1]
      const w0 = layout.widths[i]
      const h0 = layout.heights[i]
      const w1 = layout.widths[i + 1]
      const o0 = offsets[i] ?? { x: 0, y: 0 }
      const o1 = offsets[i + 1] ?? { x: 0, y: 0 }
      if (!b0 || !b1) continue
      const ax = b0.left + w0 / 2 + o0.x
      const ay = b0.top + h0 + o0.y
      const gx = b1.left + w1 / 2 + o1.x
      const gy = b1.top + o1.y
      const mx = (ax + gx) / 2
      const my = (ay + gy) / 2
      const dist = Math.hypot(gx - ax, gy - ay) || 1
      const ropeCfg = resolveRopeConfig(list, i, ropeDefaults, ropesByIndex)
      const sagMax =
        typeof ropeCfg.maxSagPx === 'number' && Number.isFinite(ropeCfg.maxSagPx)
          ? ropeCfg.maxSagPx
          : 36
      const sagFactor =
        typeof ropeCfg.sagFactor === 'number' && Number.isFinite(ropeCfg.sagFactor)
          ? ropeCfg.sagFactor
          : 0.14
      const sag = Math.min(sagMax, dist * sagFactor)
      const qySag = my + sag
      ropePaths.push(
        <PipelineRopePath
          key={`rope-${list[i]?.id ?? i}`}
          d={`M ${ax} ${ay} Q ${mx} ${qySag} ${gx} ${gy}`}
          config={ropeCfg}
          fadeTransitions={chromeFadeTransitions}
          stroke={ropeCfg.stroke}
          strokeWidth={ropeCfg.strokeWidth}
        />,
      )
    }
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-25">
      {list.map((card, index) => {
        const b = layout.bases[index]
        const h = layout.heights[index]
        const w = layout.widths[index]
        const off = offsets[index] ?? { x: 0, y: 0 }
        if (!b) return null
        const rowGap =
          typeof card.rowGapPx === 'number' && Number.isFinite(card.rowGapPx)
            ? card.rowGapPx
            : cardRowGapPx
        const outlineCfg = resolveCardOutlineConfig(card, cardOutlineDefaults)

        return (
          <div
            key={card.id ?? index}
            role="presentation"
            className="absolute z-10 flex cursor-grab touch-none flex-col overflow-hidden bg-black active:cursor-grabbing"
            style={{
              width: w,
              height: h,
              left: b.left + off.x,
              top: b.top + off.y,
            }}
            onPointerDown={(e) => onPointerDown(e, index)}
          >
            <PipelineCardOutline
              config={outlineCfg}
              fadeTransitions={chromeFadeTransitions}
            />
            <PipelineCardRows
              rows={card.rows}
              rowDefaults={cardRowDefaults}
              fadeTransitions={cardFadeTransitions}
              sceneReady
              gapPx={rowGap}
            />
          </div>
        )
      })}
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden>
        {ropePaths}
      </svg>
    </div>
  )
}
