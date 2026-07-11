import { useEffect, useState, type CSSProperties } from 'react'
import { View } from '@tarojs/components'

/**
 * Apple Music-style fluid dynamic background.
 *
 * Extracts dominant vibrant colors from the cover image via an offscreen
 * canvas, then renders 5 large blurred color "blobs" that drift and morph
 * with organic CSS keyframe animations. The heavy blur (50px) dissolves
 * visible blob boundaries so colors blend into a seamless fluid gradient —
 * the hallmark of Apple Music's now-playing screen.
 *
 * Color extraction uses crossOrigin='anonymous'; if the image is tainted
 * (CORS failure) or fails to load, a curated default palette is used.
 */

interface FluidBackgroundProps {
  src: string
}

/** Fallback palette — muted, jewel-toned colors that blend well on dark base. */
const DEFAULT_COLORS = [
  'rgb(99, 102, 241)',   // indigo
  'rgb(168, 85, 247)',   // purple
  'rgb(236, 72, 153)',   // pink
  'rgb(14, 165, 233)',   // sky
  'rgb(16, 185, 129)',   // emerald
]

/** Boost saturation and normalize lightness so colors pop as background. */
function boostVibrance(r: number, g: number, b: number): string {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break
      case gn: h = (bn - rn) / d + 2; break
      case bn: h = (rn - gn) / d + 4; break
    }
    h /= 6
  }

  s = Math.min(1, s * 1.4 + 0.08)
  const nl = Math.max(0.4, Math.min(0.65, l * 1.05))

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r1: number, g1: number, b1: number
  if (s === 0) {
    r1 = g1 = b1 = nl
  } else {
    const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s
    const p = 2 * nl - q
    r1 = hue2rgb(p, q, h + 1 / 3)
    g1 = hue2rgb(p, q, h)
    b1 = hue2rgb(p, q, h - 1 / 3)
  }

  return `rgb(${Math.round(r1 * 255)},${Math.round(g1 * 255)},${Math.round(b1 * 255)})`
}

/** Extract up to 5 vibrant colors from the cover image. */
function extractColors(src: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'

    const done = (colors: string[]): void => {
      img.onload = null
      img.onerror = null
      resolve(colors)
    }

    img.onload = (): void => {
      try {
        const size = 48
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return done(DEFAULT_COLORS)

        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data

        const bucket = new Map<string, { r: number; g: number; b: number; count: number }>()

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          const qr = Math.round(r / 24) * 24
          const qg = Math.round(g / 24) * 24
          const qb = Math.round(b / 24) * 24
          const key = `${qr},${qg},${qb}`

          const existing = bucket.get(key)
          if (existing) {
            existing.count++
          } else {
            bucket.set(key, { r: qr, g: qg, b: qb, count: 1 })
          }
        }

        const scored = [...bucket.values()].map((c) => {
          const max = Math.max(c.r, c.g, c.b)
          const min = Math.min(c.r, c.g, c.b)
          const lum = (max + min) / 2
          const sat = max === 0 ? 0 : (max - min) / max

          if (lum < 25 || lum > 235) return { ...c, score: 0 }
          if (sat < 0.12) return { ...c, score: 0 }

          const lumScore = 1 - Math.abs(lum - 130) / 130
          const score = sat * Math.sqrt(c.count) * (0.4 + lumScore * 0.6)
          return { ...c, score }
        })

        scored.sort((a, b) => b.score - a.score)

        const picked: Array<{ r: number; g: number; b: number }> = []
        for (const c of scored) {
          if (c.score <= 0) continue
          const tooSimilar = picked.some(
            (p) =>
              Math.abs(p.r - c.r) < 45 &&
              Math.abs(p.g - c.g) < 45 &&
              Math.abs(p.b - c.b) < 45,
          )
          if (!tooSimilar) picked.push(c)
          if (picked.length >= 5) break
        }

        while (picked.length < 5) {
          const idx = picked.length
          const m = DEFAULT_COLORS[idx].match(/\d+/g)
          if (m) picked.push({ r: +m[0], g: +m[1], b: +m[2] })
        }

        done(picked.map((c) => boostVibrance(c.r, c.g, c.b)))
      } catch {
        done(DEFAULT_COLORS)
      }
    }

    img.onerror = (): void => done(DEFAULT_COLORS)
    img.src = src
  })
}

interface BlobConfig {
  size: string
  top: string
  left: string
  animation: string
  duration: string
  delay: string
}

const BLOB_CONFIGS: BlobConfig[] = [
  { size: '85vmin', top: '-12%', left: '-8%',  animation: 'fluid-blob-1', duration: '24s', delay: '0s' },
  { size: '75vmin', top: '-5%',  left: '42%',  animation: 'fluid-blob-2', duration: '29s', delay: '-4s' },
  { size: '80vmin', top: '28%',  left: '8%',   animation: 'fluid-blob-3', duration: '26s', delay: '-8s' },
  { size: '70vmin', top: '42%',  left: '48%',  animation: 'fluid-blob-4', duration: '31s', delay: '-2s' },
  { size: '72vmin', top: '58%',  left: '18%',  animation: 'fluid-blob-5', duration: '27s', delay: '-11s' },
]

const containerStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
  backgroundColor: '#fbf9f8',
  zIndex: 0,
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(251, 249, 248, 0.3)',
}

export default function FluidBackground({ src }: FluidBackgroundProps) {
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    extractColors(src).then((c) => {
      if (!cancelled) setColors(c)
    })
    return (): void => {
      cancelled = true
    }
  }, [src])

  return (
    <View style={containerStyle}>
      {BLOB_CONFIGS.map((blob, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: blob.size,
            height: blob.size,
            top: blob.top,
            left: blob.left,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors[i % colors.length]} 0%, transparent 65%)`,
            filter: 'blur(50px)',
            opacity: 0.7,
            willChange: 'transform',
            animationName: blob.animation,
            animationDuration: blob.duration,
            animationDelay: blob.delay,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          }}
        />
      ))}
      <View style={overlayStyle} />
    </View>
  )
}
