import * as THREE from 'three/webgpu'

/**
 * Value noise + fBm → высота, нормаль, вариация шероховатости и лёгкий albedo-шум
 * для PBR-металлов без внешних изображений.
 *
 * roughnessMap: зелёный канал (у нас R=G=B).
 * metalnessMap: синий канал в Three.js; для совместимости R=G=B.
 * normalMap: касательное пространство, Y вверх.
 */

const PRESETS = {
  /** Крупное зерно, ямки окисления, читаемая рельефная сетка. */
  copper: {
    fbmScale: 38,
    octaves: 5,
    normalScale: 1.05,
    heightNormalBoost: 12,
    roughnessMin: 0.48,
    roughnessMax: 1,
    roughnessMicro: 0.12,
    roughnessScratch: 0.09,
    metalnessMin: 0.62,
    metalnessMax: 0.98,
    pitStrength: 0.55,
    brushed: false,
  },
  /** Крупные матовые пятна, сильный рельеф. */
  lead: {
    fbmScale: 14,
    octaves: 4,
    normalScale: 0.55,
    heightNormalBoost: 11,
    roughnessMin: 0.55,
    roughnessMax: 1,
    roughnessMicro: 0.14,
    roughnessScratch: 0.07,
    metalnessMin: 0.35,
    metalnessMax: 0.82,
    pitStrength: 0.2,
    brushed: false,
  },
  /** Грубые полосы шлифовки, видимый направленный рисунок. */
  aluminum: {
    fbmScale: 28,
    octaves: 4,
    normalScale: 0.88,
    heightNormalBoost: 14,
    roughnessMin: 0.42,
    roughnessMax: 1,
    roughnessMicro: 0.11,
    roughnessScratch: 0.1,
    metalnessMin: 0.52,
    metalnessMax: 0.96,
    pitStrength: 0,
    brushed: true,
  },
  /** Слитковая кора + пятна, глубокие нормали. */
  bronze: {
    fbmScale: 22,
    octaves: 5,
    normalScale: 0.95,
    heightNormalBoost: 12,
    roughnessMin: 0.46,
    roughnessMax: 1,
    roughnessMicro: 0.13,
    roughnessScratch: 0.08,
    metalnessMin: 0.55,
    metalnessMax: 0.94,
    pitStrength: 0.5,
    brushed: false,
  },
}

function hash2(x, y, s) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + s * 0.01) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise2(x, y, s) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash2(x0, y0, s)
  const b = hash2(x0 + 1, y0, s)
  const c = hash2(x0, y0 + 1, s)
  const d = hash2(x0 + 1, y0 + 1, s)
  const ax = a + (b - a) * u
  const bx = c + (d - c) * u
  return ax + (bx - ax) * v
}

function fbm2(x, y, octaves, s) {
  let v = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < octaves; i += 1) {
    v += a * smoothNoise2(x * f, y * f, s + i * 31.7)
    a *= 0.5
    f *= 2
  }
  return v
}

function fillCanvasLinear(canvas, fn) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const u = (x + 0.5) / w
      const v = (y + 0.5) / h
      const t = fn(u, v, x, y)
      const i = (y * w + x) * 4
      d[i] = t
      d[i + 1] = t
      d[i + 2] = t
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function fillCanvasNormal(canvas, heightFn, normalScale) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const x1 = x < w - 1 ? x + 1 : x
      const x0 = x > 0 ? x - 1 : x
      const y1 = y < h - 1 ? y + 1 : y
      const y0 = y > 0 ? y - 1 : y
      const h0 = heightFn(x, y0)
      const h1 = heightFn(x, y1)
      const hL = heightFn(x0, y)
      const hR = heightFn(x1, y)
      const dx = (hL - hR) * normalScale
      const dy = (h0 - h1) * normalScale
      let nx = -dx
      let ny = -dy
      let nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= len
      ny /= len
      nz /= len
      d[i] = Math.round(nx * 0.5 + 0.5)
      d[i + 1] = Math.round(ny * 0.5 + 0.5)
      d[i + 2] = Math.round(nz * 0.5 + 0.5)
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function textureFromCanvas(canvas, colorSpace, repeatU, repeatV) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = colorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatU, repeatV)
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/**
 * @param {'copper'|'lead'|'aluminum'|'bronze'} presetName
 * @param {number} seed
 * @param {{ uvRepeatU?: number, uvRepeatV?: number }} [opts]
 * @returns {{
 *   textures: {
 *     map: THREE.CanvasTexture,
 *     roughnessMap: THREE.CanvasTexture,
 *     metalnessMap: THREE.CanvasTexture,
 *     normalMap: THREE.CanvasTexture,
 *   },
 *   normalScale: THREE.Vector2,
 *   dispose: () => void,
 * }}
 */
export function createMetalProceduralMaps(presetName, seed = 0, opts = {}) {
  const preset = PRESETS[presetName] ?? PRESETS.copper
  const size = 512
  const repeatU = opts.uvRepeatU ?? 2
  const repeatV = opts.uvRepeatV ?? 2

  const heightBuffer = new Float32Array(size * size)

  const heightAtPixel = (px, py) => heightBuffer[py * size + px]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      let n = fbm2(u * preset.fbmScale, v * preset.fbmScale, preset.octaves, seed)
      if (preset.brushed) {
        n += 0.38 * fbm2(u * 5 + Math.sin(v * 55) * 0.1, v * 18, 3, seed + 11)
        n += 0.22 * Math.sin(v * 64 + u * 14)
        n += 0.12 * fbm2(u * 2, v * 36, 2, seed + 17)
      }
      const pit = Math.pow(Math.max(0, smoothNoise2(u * 12, v * 12, seed + 3) - 0.65) * 3, 1.8)
      if (presetName === 'copper' || presetName === 'bronze') {
        n -= pit * (preset.pitStrength ?? 0.5)
      }
      heightBuffer[y * size + x] = n
    }
  }

  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i < heightBuffer.length; i += 1) {
    mn = Math.min(mn, heightBuffer[i])
    mx = Math.max(mx, heightBuffer[i])
  }
  const range = mx - mn || 1
  for (let i = 0; i < heightBuffer.length; i += 1) {
    heightBuffer[i] = (heightBuffer[i] - mn) / range
  }

  const roughMicro = preset.roughnessMicro ?? 0.1
  const roughScratch = preset.roughnessScratch ?? 0.07
  const metalMin = preset.metalnessMin ?? 0.5
  const metalMax = preset.metalnessMax ?? 1

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  fillCanvasLinear(roughCanvas, (u, v, x, y) => {
    const h = heightAtPixel(x, y)
    let r = preset.roughnessMin + h * (preset.roughnessMax - preset.roughnessMin)
    const micro = fbm2(u * 220, v * 220, 3, seed + 41)
    const scratch = Math.pow(Math.abs(smoothNoise2(u * 380, v * 380, seed + 50) - 0.5) * 2, 1.4)
    const wipe = smoothNoise2(u * 16, v * 16, seed + 60)
    r += micro * roughMicro
    r += scratch * roughScratch
    r += (wipe - 0.5) * 0.09
    return Math.min(1, Math.max(0, r))
  })

  const metalCanvas = document.createElement('canvas')
  metalCanvas.width = size
  metalCanvas.height = size
  fillCanvasLinear(metalCanvas, (u, v, x, y) => {
    const h = heightAtPixel(x, y)
    let m = metalMin + h * (metalMax - metalMin)
    const fine = fbm2(u * 165, v * 165, 4, seed + 71)
    const fleck = smoothNoise2(u * 92, v * 92, seed + 81)
    const pitDark = presetName === 'copper' || presetName === 'bronze'
      ? Math.pow(Math.max(0, smoothNoise2(u * 28, v * 28, seed + 91) - 0.78) * 5, 2)
      : 0
    m *= 0.76 + 0.24 * fine
    m *= 0.9 + 0.1 * fleck
    if (pitDark > 0.01) m *= 1 - pitDark * 0.35
    if (fleck > 0.965) m *= 0.82
    return Math.min(1, Math.max(0, m))
  })

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = size
  normalCanvas.height = size
  const normalBoost = preset.heightNormalBoost ?? 10
  fillCanvasNormal(
    normalCanvas,
    (px, py) => heightAtPixel(px, py),
    normalBoost,
  )

  /** Заметная модуляция альбедо — умножается на `material.color`. */
  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = size
  mapCanvas.height = size
  const mapCtx = mapCanvas.getContext('2d')
  const mapImg = mapCtx.createImageData(size, size)
  const md = mapImg.data
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const h = heightAtPixel(x, y)
      const fine = smoothNoise2(u * 90, v * 90, seed + 19)
      const streak = preset.brushed ? 0.12 * Math.sin(v * 70 + u * 9) : 0
      let shade = 0.68 + h * 0.24 + (fine - 0.5) * 0.14 + streak
      shade = Math.min(1, Math.max(0.58, shade))
      let r = shade * 255
      let g = shade * 255
      let b = shade * 255
      if (presetName === 'copper') {
        r += 22 * (1 - h) + 8 * fine
        g += 10 * h
        b -= 14 * h
      } else if (presetName === 'lead') {
        r -= 18 * h
        g -= 14 * h
        b += 16 * (1 - h)
      } else if (presetName === 'aluminum') {
        r += 14 * h + streak * 40
        g += 14 * h + streak * 35
        b += 20 * h + streak * 45
      } else if (presetName === 'bronze') {
        r += 24 * (1 - h)
        g += 12 * h
        b -= 18 * h
      }
      const i = (y * size + x) * 4
      md[i] = Math.min(255, Math.max(0, r))
      md[i + 1] = Math.min(255, Math.max(0, g))
      md[i + 2] = Math.min(255, Math.max(0, b))
      md[i + 3] = 255
    }
  }
  mapCtx.putImageData(mapImg, 0, 0)

  const roughnessMap = textureFromCanvas(roughCanvas, THREE.NoColorSpace, repeatU, repeatV)
  const metalnessMap = textureFromCanvas(metalCanvas, THREE.NoColorSpace, repeatU, repeatV)
  const normalMap = textureFromCanvas(normalCanvas, THREE.NoColorSpace, repeatU, repeatV)
  const map = textureFromCanvas(mapCanvas, THREE.SRGBColorSpace, repeatU, repeatV)

  const normalScale = new THREE.Vector2(preset.normalScale, preset.normalScale)

  const all = [roughnessMap, metalnessMap, normalMap, map]

  return {
    textures: { map, roughnessMap, metalnessMap, normalMap },
    normalScale,
    dispose() {
      for (const t of all) t.dispose()
    },
  }
}
