import { useEffect, useRef } from 'react'
import { View } from '@tarojs/components'

/**
 * AMLLBackground — faithful WebGL port of Apple Music-like Lyrics'
 * MeshGradientRenderer (the project's default renderer).
 *
 * Pipeline:
 * 1. Color extraction: cover → 32×32 downsample → AMLL color matrix
 *    (contrast 0.4 → saturate 3.0 → contrast 1.7 → brightness 0.75 → blur 2px)
 *    via ctx.filter at draw time. Produces a vivid, pure-color texture.
 * 2. Mesh geometry: bicubic Hermite patch with random control-point presets,
 *    matching AMLL's BHPMesh. Static geometry — only the UVs rotate.
 * 3. Fragment shader: rotates UVs around center, samples the 32×32 texture
 *    with MIRRORED_REPEAT + LINEAR filtering, applies a vignette (edges to
 *    60%), adds a dither. This per-pixel sampling is what keeps colors clean
 *    — no Canvas 2D scaling artifacts or muddy sprite overlap.
 * 4. FBO compositing: each cover renders to an FBO, then alpha-blends to
 *    screen. Cross-fade when cover changes.
 *
 * H5 only. On other platforms the component renders nothing.
 */

interface AMLLBackgroundProps {
  src: string
}

const IS_H5 = process.env.TARO_ENV === 'h5'
const COLOR_TEX_SIZE = 32
const SUBDIVISIONS = 20
const FLOW_SPEED = 0.2
const RENDER_SCALE = 0.75

// ===== Shaders (exact from AMLL mesh-renderer) =====

const meshVertShader = `
attribute vec2 a_pos;
attribute vec3 a_color;
attribute vec2 a_uv;
varying vec3 v_color;
varying vec2 v_uv;
uniform float u_aspect;
void main() {
    v_color = a_color;
    v_uv = a_uv;
    vec2 pos = a_pos;
    if (u_aspect > 1.0) {
        pos.y *= u_aspect;
    } else {
        pos.x /= u_aspect;
    }
    gl_Position = vec4(pos, 0.0, 1.0);
}
`

const meshFragShader = `
precision mediump float;
varying vec3 v_color;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_volume;
uniform float u_alpha;
uniform float u_sinAngle;
uniform float u_cosAngle;
const float INV_255 = 1.0 / 255.0;
const float HALF_INV_255 = 0.5 / 255.0;
const float GRADIENT_NOISE_A = 52.9829189;
const vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);
float gradientNoise(in vec2 uv) {
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));
}
void main() {
    float volumeEffect = u_volume * 2.0;
    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;
    vec2 centeredUV = v_uv - vec2(0.2);
    vec2 rotatedUV = vec2(
        u_cosAngle * centeredUV.x - u_sinAngle * centeredUV.y,
        u_sinAngle * centeredUV.x + u_cosAngle * centeredUV.y
    );
    vec2 finalUV = rotatedUV * max(0.001, 1.0 - volumeEffect) + vec2(0.5);
    vec4 result = texture2D(u_texture, finalUV);
    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);
    result.rgb *= v_color * alphaVolumeFactor;
    result.a *= alphaVolumeFactor;
    result.rgb += vec3(dither);
    float dist = distance(v_uv, vec2(0.5));
    float vignette = smoothstep(0.8, 0.3, dist);
    float mask = 0.6 + vignette * 0.4;
    result.rgb *= mask;
    gl_FragColor = result;
}
`

const quadVertShader = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_pos * 0.5 + 0.5;
}
`

const quadFragShader = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_alpha;
void main() {
    vec4 color = texture2D(u_texture, v_uv);
    gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`

// ===== Minimal Mat4/Vec4 (column-major, matching gl-matrix) =====

type Mat4 = Float32Array
type Vec4 = Float32Array

function mat4Create(): Mat4 {
  return new Float32Array(16)
}

function mat4Transpose(out: Mat4, m: Mat4): Mat4 {
  if (out === m) {
    const a01 = m[1], a02 = m[2], a03 = m[3]
    const a12 = m[6], a13 = m[7]
    const a23 = m[11]
    out[1] = m[4]; out[2] = m[8]; out[3] = m[12]
    out[4] = a01; out[6] = m[9]; out[7] = m[13]
    out[8] = a02; out[9] = a12; out[11] = m[14]
    out[12] = a03; out[13] = a13; out[14] = a23
  } else {
    out[0] = m[0]; out[1] = m[4]; out[2] = m[8]; out[3] = m[12]
    out[4] = m[1]; out[5] = m[5]; out[6] = m[9]; out[7] = m[13]
    out[8] = m[2]; out[9] = m[6]; out[10] = m[10]; out[11] = m[14]
    out[12] = m[3]; out[13] = m[7]; out[14] = m[11]; out[15] = m[15]
  }
  return out
}

function mat4Multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3]
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7]
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11]
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15]
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3]
    out[col * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[col * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[col * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[col * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  }
  return out
}

function vec4TransformMat4(out: Vec4, v: Vec4, m: Mat4): Vec4 {
  const x = v[0], y = v[1], z = v[2], w = v[3]
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w
  return out
}

// ===== Hermite basis matrix =====

const H = new Float32Array([2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0])
const H_T = mat4Transpose(mat4Create(), H)

// ===== Control Points =====

interface ControlPoint {
  location: [number, number]
  uTangent: [number, number]
  vTangent: [number, number]
}

interface PresetConf {
  x: number; y: number; ur: number; vr: number; up: number; vp: number
}
interface Preset {
  width: number; height: number; conf: PresetConf[]
}

const PRESETS: Preset[] = [
  {
    width: 5, height: 5, conf: [
      { x: -1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.5, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.5, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: -0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.5, y: -0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.005, y: -0.613, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.588, y: -0.399, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: -0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 0, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.421, y: -0.119, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.102, y: -0.024, ur: 0, vr: -47, up: 0.629, vp: 0.849 },
      { x: 0.403, y: -0.063, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 0, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.068, y: 0.521, ur: -31, vr: -45, up: 1, vp: 1 },
      { x: 0.214, y: 0.293, ur: 6, vr: -56, up: 0.566, vp: 1.321 },
      { x: 0.5, y: 0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 0.5, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.314, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.262, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.5, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
    ],
  },
  {
    width: 4, height: 4, conf: [
      { x: -1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.333, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.333, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: -0.045, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.241, y: -0.225, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.335, y: -0.005, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.999, y: -0.338, ur: 8, vr: 0, up: 0.566, vp: 1.792 },
      { x: -1, y: 0.333, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.343, y: 0, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.332, y: 0.198, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 0.077, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.333, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.333, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
    ],
  },
  {
    width: 5, height: 5, conf: [
      { x: -1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.45, y: -1, ur: 0, vr: 55, up: 1, vp: 2.075 },
      { x: 0.195, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 0.458, y: -1, ur: 0, vr: -25, up: 1, vp: 1 },
      { x: 1, y: -1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: -0.251, ur: -16, vr: 0, up: 2.327, vp: 0.943 },
      { x: -0.559, y: -0.661, ur: 47, vr: 0, up: 2.358, vp: 0.377 },
      { x: 0.232, y: -0.524, ur: -66, vr: -25, up: 1.855, vp: 1.164 },
      { x: 0.686, y: -0.375, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: -0.67, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 0.036, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.492, y: 0.005, ur: 90, vr: 23, up: 1, vp: 1.981 },
      { x: 0.021, y: -0.137, ur: 0, vr: 42, up: 1, vp: 1 },
      { x: 0.477, y: 0.059, ur: -30, vr: 0, up: 1.95, vp: 0.44 },
      { x: 1, y: 0.251, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -1, y: 0.697, ur: -68, vr: 0, up: 1, vp: 0.786 },
      { x: -0.69, y: 0.589, ur: -68, vr: 0, up: 1, vp: 1 },
      { x: 0.185, y: 0.388, ur: 61, vr: 0, up: 1, vp: 1 },
      { x: 0.605, y: 0.463, ur: -47, vr: -59, up: 0.849, vp: 1.73 },
      { x: 1, y: 0.621, ur: -33, vr: 0, up: 0.377, vp: 1.604 },
      { x: -1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: -0.5, y: 1, ur: 0, vr: -73, up: 1, vp: 1 },
      { x: -0.327, y: 1, ur: 0, vr: -24, up: 0.314, vp: 2.704 },
      { x: 0.5, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
      { x: 1, y: 1, ur: 0, vr: 0, up: 1, vp: 1 },
    ],
  },
]

function buildControlPoints(preset: Preset): ControlPoint[][] {
  const grid: ControlPoint[][] = []
  const uPower = 2 / (preset.width - 1)
  const vPower = 2 / (preset.height - 1)
  for (let y = 0; y < preset.height; y++) {
    grid[y] = []
    for (let x = 0; x < preset.width; x++) {
      const cp = preset.conf[y * preset.width + x]
      const ur = (cp.ur * Math.PI) / 180
      const vr = (cp.vr * Math.PI) / 180
      grid[y][x] = {
        location: [cp.x, cp.y],
        uTangent: [Math.cos(ur) * uPower * cp.up, Math.sin(ur) * uPower * cp.up],
        vTangent: [-Math.sin(vr) * vPower * cp.vp, Math.cos(vr) * vPower * cp.vp],
      }
    }
  }
  return grid
}

// ===== Bicubic Hermite Patch Mesh =====

function meshCoefficients(
  p00: ControlPoint, p01: ControlPoint, p10: ControlPoint, p11: ControlPoint,
  axis: 0 | 1, out: Mat4,
): Mat4 {
  out[0] = p00.location[axis]
  out[1] = p01.location[axis]
  out[2] = p00.vTangent[axis]
  out[3] = p01.vTangent[axis]
  out[4] = p10.location[axis]
  out[5] = p11.location[axis]
  out[6] = p10.vTangent[axis]
  out[7] = p11.vTangent[axis]
  out[8] = p00.uTangent[axis]
  out[9] = p01.uTangent[axis]
  out[10] = 0
  out[11] = 0
  out[12] = p10.uTangent[axis]
  out[13] = p11.uTangent[axis]
  out[14] = 0
  out[15] = 0
  return out
}

function precomputeMatrix(M: Mat4, out: Mat4): Mat4 {
  mat4Transpose(out, M)
  mat4Multiply(out, out, H)
  mat4Multiply(out, H_T, out)
  return out
}

interface MeshData {
  vertices: Float32Array
  indices: Uint16Array
}

const meshCache: MeshData[] = PRESETS.map((p) => computeMesh(p, SUBDIVISIONS))

function computeMesh(preset: Preset, subdivisions: number): MeshData {
  const cp = buildControlPoints(preset)
  const cpW = preset.width
  const cpH = preset.height
  const subDivM1 = subdivisions - 1
  const tW = subDivM1 * (cpH - 1)
  const tH = subDivM1 * (cpW - 1)
  const invTH = 1 / tH
  const invTW = 1 / tW

  const vertexWidth = (cpW - 1) * subdivisions
  const vertexHeight = (cpH - 1) * subdivisions

  const vertices = new Float32Array(vertexWidth * vertexHeight * 7)
  const indices = new Uint16Array(vertexWidth * vertexHeight * 6)

  const normPowers = new Float32Array(subdivisions * 4)
  for (let i = 0; i < subdivisions; i++) {
    const norm = i / subDivM1
    const idx = i * 4
    normPowers[idx] = norm ** 3
    normPowers[idx + 1] = norm ** 2
    normPowers[idx + 2] = norm
    normPowers[idx + 3] = 1
  }

  const tempX = mat4Create(), tempY = mat4Create()
  const tempXAcc = mat4Create(), tempYAcc = mat4Create()
  const tempUX = new Float32Array(4)
  const tempUY = new Float32Array(4)

  for (let x = 0; x < cpW - 1; x++) {
    for (let y = 0; y < cpH - 1; y++) {
      const p00 = cp[y][x]
      const p01 = cp[y + 1][x]
      const p10 = cp[y][x + 1]
      const p11 = cp[y + 1][x + 1]

      meshCoefficients(p00, p01, p10, p11, 0, tempX)
      meshCoefficients(p00, p01, p10, p11, 1, tempY)
      precomputeMatrix(tempX, tempXAcc)
      precomputeMatrix(tempY, tempYAcc)

      const sX = x / (cpW - 1)
      const sY = y / (cpH - 1)
      const baseVx = y * subdivisions
      const baseVy = x * subdivisions

      for (let u = 0; u < subdivisions; u++) {
        const vxOffset = baseVx + u
        const uIdx = u * 4

        tempUX[0] = normPowers[uIdx]
        tempUX[1] = normPowers[uIdx + 1]
        tempUX[2] = normPowers[uIdx + 2]
        tempUX[3] = normPowers[uIdx + 3]
        vec4TransformMat4(tempUX, tempUX, tempXAcc)

        tempUY[0] = normPowers[uIdx]
        tempUY[1] = normPowers[uIdx + 1]
        tempUY[2] = normPowers[uIdx + 2]
        tempUY[3] = normPowers[uIdx + 3]
        vec4TransformMat4(tempUY, tempUY, tempYAcc)

        for (let v = 0; v < subdivisions; v++) {
          const vy = baseVy + v
          const vIdx = v * 4
          const v0 = normPowers[vIdx]
          const v1 = normPowers[vIdx + 1]
          const v2 = normPowers[vIdx + 2]
          const v3 = normPowers[vIdx + 3]

          const px = v0 * tempUX[0] + v1 * tempUX[1] + v2 * tempUX[2] + v3 * tempUX[3]
          const py = v0 * tempUY[0] + v1 * tempUY[1] + v2 * tempUY[2] + v3 * tempUY[3]
          const uvX = sX + v * invTH
          const uvY = 1 - sY - u * invTW

          const idx = (vxOffset + vy * vertexWidth) * 7
          vertices[idx] = px
          vertices[idx + 1] = py
          vertices[idx + 2] = 1
          vertices[idx + 3] = 1
          vertices[idx + 4] = 1
          vertices[idx + 5] = uvX
          vertices[idx + 6] = uvY
        }
      }
    }
  }

  for (let y = 0; y < vertexHeight - 1; y++) {
    for (let x = 0; x < vertexWidth - 1; x++) {
      const idx = (y * vertexWidth + x) * 6
      indices[idx] = y * vertexWidth + x
      indices[idx + 1] = y * vertexWidth + x + 1
      indices[idx + 2] = (y + 1) * vertexWidth + x
      indices[idx + 3] = y * vertexWidth + x + 1
      indices[idx + 4] = (y + 1) * vertexWidth + x + 1
      indices[idx + 5] = (y + 1) * vertexWidth + x
    }
  }

  return { vertices, indices }
}

// ===== Helpers =====

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function loadImage(src: string, cache: Map<string, HTMLImageElement>): Promise<HTMLImageElement> {
  const cached = cache.get(src)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = (): void => {
      cache.set(src, img)
      resolve(img)
    }
    img.onerror = (): void => reject(new Error(`failed to load cover: ${src}`))
    img.src = src
  })
}

/**
 * Stack blur — exact port of AMLL's blurImage (img.ts).
 * Operates in-place on ImageData. radius=2, quality=4 (4 iterations)
 * produces a box blur that approximates Gaussian.
 */
function blurImage(imageData: ImageData, radius: number, quality: number): void {
  const pixels = imageData.data
  const width = imageData.width
  const height = imageData.height

  let rsum: number, gsum: number, bsum: number, asum: number
  let x: number, y: number, i: number, p: number, p1: number, p2: number
  let yp: number, yi: number, yw: number
  const wm = width - 1
  const hm = height - 1
  const rad1x = radius + 1
  const divx = radius + rad1x
  const rad1y = radius + 1
  const divy = radius + rad1y
  const div2 = 1 / (divx * divy)

  const r: number[] = []
  const g: number[] = []
  const b: number[] = []
  const a: number[] = []
  const vmin: number[] = []
  const vmax: number[] = []

  while (quality-- > 0) {
    yw = yi = 0

    for (y = 0; y < height; y++) {
      rsum = pixels[yw] * rad1x
      gsum = pixels[yw + 1] * rad1x
      bsum = pixels[yw + 2] * rad1x
      asum = pixels[yw + 3] * rad1x

      for (i = 1; i <= radius; i++) {
        p = yw + ((i > wm ? wm : i) << 2)
        rsum += pixels[p++]
        gsum += pixels[p++]
        bsum += pixels[p++]
        asum += pixels[p]
      }

      for (x = 0; x < width; x++) {
        r[yi] = rsum
        g[yi] = gsum
        b[yi] = bsum
        a[yi] = asum

        if (y === 0) {
          vmin[x] = Math.min(x + rad1x, wm) << 2
          vmax[x] = Math.max(x - radius, 0) << 2
        }

        p1 = yw + vmin[x]
        p2 = yw + vmax[x]

        rsum += pixels[p1++] - pixels[p2++]
        gsum += pixels[p1++] - pixels[p2++]
        bsum += pixels[p1++] - pixels[p2++]
        asum += pixels[p1] - pixels[p2]

        yi++
      }
      yw += width << 2
    }

    for (x = 0; x < width; x++) {
      yp = x
      rsum = r[yp] * rad1y
      gsum = g[yp] * rad1y
      bsum = b[yp] * rad1y
      asum = a[yp] * rad1y

      for (i = 1; i <= radius; i++) {
        yp += i > hm ? 0 : width
        rsum += r[yp]
        gsum += g[yp]
        bsum += b[yp]
        asum += a[yp]
      }

      yi = x << 2
      for (y = 0; y < height; y++) {
        pixels[yi] = (rsum * div2 + 0.5) | 0
        pixels[yi + 1] = (gsum * div2 + 0.5) | 0
        pixels[yi + 2] = (bsum * div2 + 0.5) | 0
        pixels[yi + 3] = (asum * div2 + 0.5) | 0

        if (x === 0) {
          vmin[y] = Math.min(y + rad1y, hm) * width
          vmax[y] = Math.max(y - radius, 0) * width
        }

        p1 = x + vmin[y]
        p2 = x + vmax[y]

        rsum += r[p1] - r[p2]
        gsum += g[p1] - g[p2]
        bsum += b[p1] - b[p2]
        asum += a[p1] - a[p2]

        yi += width << 2
      }
    }
  }
}

/**
 * Color extraction — exact port of AMLL's setAlbum pipeline.
 * 1. Downsample cover to 32×32 (no filter).
 * 2. getImageData → manual per-pixel color matrix:
 *    contrast(0.4) → saturate(3.0, Rec.601) → contrast(1.7) → brightness(0.75)
 * 3. blurImage(imageData, 2, 4) — stack blur.
 * Returns ImageData for direct WebGL texture upload.
 *
 * Uses Rec. 601 luminance (0.3, 0.59, 0.11) — NOT CSS's Rec. 709 —
 * which is what gives AMLL its vivid, clean color separation.
 */
function buildPaletteTexture(img: HTMLImageElement): ImageData | null {
  const c = document.createElement('canvas')
  c.width = COLOR_TEX_SIZE
  c.height = COLOR_TEX_SIZE
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, COLOR_TEX_SIZE, COLOR_TEX_SIZE)

  const imageData = ctx.getImageData(0, 0, COLOR_TEX_SIZE, COLOR_TEX_SIZE)
  const pixels = imageData.data

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i]
    let g = pixels[i + 1]
    let b = pixels[i + 2]

    // contrast 0.4
    r = (r - 128) * 0.4 + 128
    g = (g - 128) * 0.4 + 128
    b = (b - 128) * 0.4 + 128

    // saturate 3.0 (Rec. 601 luminance)
    const gray = r * 0.3 + g * 0.59 + b * 0.11
    r = gray * -2.0 + r * 3.0
    g = gray * -2.0 + g * 3.0
    b = gray * -2.0 + b * 3.0

    // contrast 1.7
    r = (r - 128) * 1.7 + 128
    g = (g - 128) * 1.7 + 128
    b = (b - 128) * 1.7 + 128

    // brightness 0.75
    pixels[i] = r * 0.75
    pixels[i + 1] = g * 0.75
    pixels[i + 2] = b * 0.75
  }

  blurImage(imageData, 2, 4)

  return imageData
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${log}`)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): {
  program: WebGLProgram
  attrs: Record<string, number>
  uniforms: Record<string, WebGLUniformLocation | null>
} {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vs)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${log}`)
  }
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  const attrs: Record<string, number> = {}
  const numAttrs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  for (let i = 0; i < numAttrs; i++) {
    const info = gl.getActiveAttrib(program, i)
    if (info) attrs[info.name] = gl.getAttribLocation(program, info.name)
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {}
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < numUniforms; i++) {
    const info = gl.getActiveUniform(program, i)
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name)
  }

  return { program, attrs, uniforms }
}

// ===== Engine =====

interface MeshState {
  vertexBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  indexCount: number
  texture: WebGLTexture
  alpha: number
}

interface Engine {
  gl: WebGLRenderingContext
  canvas: HTMLCanvasElement
  mainProgram: WebGLProgram
  mainAttrs: Record<string, number>
  mainUniforms: Record<string, WebGLUniformLocation | null>
  quadProgram: WebGLProgram
  quadAttrs: Record<string, number>
  quadUniforms: Record<string, WebGLUniformLocation | null>
  quadBuffer: WebGLBuffer
  fbo: WebGLFramebuffer
  fboTexture: WebGLTexture
  meshStates: MeshState[]
  isNoCover: boolean
  frameTime: number
  lastFrame: number
  raf: number
  running: boolean
  imgCache: Map<string, HTMLImageElement>
}

export default function AMLLBackground({ src }: AMLLBackgroundProps) {
  const hostRef = useRef<HTMLElement>(null)
  const engineRef = useRef<Engine | null>(null)

  useEffect(() => {
    if (!IS_H5) return
    const host = hostRef.current
    if (!host) return

    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    })
    host.appendChild(canvas)

    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
    if (!gl) return

    let mainProg, quadProg
    try {
      mainProg = createProgram(gl, meshVertShader, meshFragShader)
      quadProg = createProgram(gl, quadVertShader, quadFragShader)
    } catch {
      return
    }

    const quadBuffer = gl.createBuffer()
    if (!quadBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const fbo = gl.createFramebuffer()
    const fboTexture = gl.createTexture()
    if (!fbo || !fboTexture) return

    const engine: Engine = {
      gl,
      canvas,
      mainProgram: mainProg.program,
      mainAttrs: mainProg.attrs,
      mainUniforms: mainProg.uniforms,
      quadProgram: quadProg.program,
      quadAttrs: quadProg.attrs,
      quadUniforms: quadProg.uniforms,
      quadBuffer,
      fbo,
      fboTexture,
      meshStates: [],
      isNoCover: true,
      frameTime: 0,
      lastFrame: 0,
      raf: 0,
      running: true,
      imgCache: new Map(),
    }
    engineRef.current = engine

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const resize = (): void => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      const dpr = window.devicePixelRatio || 1
      const cw = Math.max(1, Math.ceil(w * dpr * RENDER_SCALE))
      const ch = Math.max(1, Math.ceil(h * dpr * RENDER_SCALE))
      if (canvas.width === cw && canvas.height === ch) return
      canvas.width = cw
      canvas.height = ch
      gl.bindTexture(gl.TEXTURE_2D, fboTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, cw, ch)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const render = (now: number): void => {
      engine.raf = requestAnimationFrame(render)
      if (!engine.running) return
      if (gl.isContextLost()) return

      const frameDelta = engine.lastFrame === 0 ? 16 : Math.min(100, now - engine.lastFrame)
      engine.lastFrame = now
      engine.frameTime += frameDelta * FLOW_SPEED

      const cw = canvas.width
      const ch = canvas.height
      const deltaFactor = frameDelta / 500
      const aspect = cw / ch

      // Update alpha states
      const latest = engine.meshStates[engine.meshStates.length - 1]
      if (engine.isNoCover) {
        for (let i = engine.meshStates.length - 1; i >= 0; i--) {
          const s = engine.meshStates[i]
          if (s.alpha <= -0.1) {
            gl.deleteBuffer(s.vertexBuffer)
            gl.deleteBuffer(s.indexBuffer)
            gl.deleteTexture(s.texture)
            engine.meshStates.splice(i, 1)
          } else {
            s.alpha = Math.max(-0.1, s.alpha - deltaFactor)
          }
        }
      } else if (latest) {
        if (latest.alpha >= 1.1) {
          const removed = engine.meshStates.splice(0, engine.meshStates.length - 1)
          for (const s of removed) {
            gl.deleteBuffer(s.vertexBuffer)
            gl.deleteBuffer(s.indexBuffer)
            gl.deleteTexture(s.texture)
          }
        } else {
          latest.alpha = Math.min(1.1, latest.alpha + deltaFactor)
        }
      }

      // Clear screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const uTime = engine.frameTime / 10000
      const angle = uTime * 2.0
      const sinA = Math.sin(angle)
      const cosA = Math.cos(angle)

      for (const state of engine.meshStates) {
        // 1. Render mesh to FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.disable(gl.BLEND)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(engine.mainProgram)
        gl.uniform1f(engine.mainUniforms['u_aspect'], aspect)
        gl.uniform1i(engine.mainUniforms['u_texture'], 0)
        gl.uniform1f(engine.mainUniforms['u_volume'], 0)
        gl.uniform1f(engine.mainUniforms['u_alpha'], 1.0)
        gl.uniform1f(engine.mainUniforms['u_sinAngle'], sinA)
        gl.uniform1f(engine.mainUniforms['u_cosAngle'], cosA)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, state.texture)

        gl.bindBuffer(gl.ARRAY_BUFFER, state.vertexBuffer)
        const aPos = engine.mainAttrs['a_pos']
        const aColor = engine.mainAttrs['a_color']
        const aUV = engine.mainAttrs['a_uv']
        if (aPos >= 0) {
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 28, 0)
          gl.enableVertexAttribArray(aPos)
        }
        if (aColor >= 0) {
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 28, 8)
          gl.enableVertexAttribArray(aColor)
        }
        if (aUV >= 0) {
          gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 28, 20)
          gl.enableVertexAttribArray(aUV)
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer)
        gl.drawElements(gl.TRIANGLES, state.indexCount, gl.UNSIGNED_SHORT, 0)

        if (aPos >= 0) gl.disableVertexAttribArray(aPos)
        if (aColor >= 0) gl.disableVertexAttribArray(aColor)
        if (aUV >= 0) gl.disableVertexAttribArray(aUV)

        // 2. Composite FBO to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

        gl.useProgram(engine.quadProgram)
        gl.uniform1i(engine.quadUniforms['u_texture'], 0)
        gl.uniform1f(engine.quadUniforms['u_alpha'], easeInOutSine(clamp01(state.alpha)))

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, fboTexture)

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
        const qPos = engine.quadAttrs['a_pos']
        if (qPos >= 0) {
          gl.vertexAttribPointer(qPos, 2, gl.FLOAT, false, 0, 0)
          gl.enableVertexAttribArray(qPos)
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        if (qPos >= 0) gl.disableVertexAttribArray(qPos)
      }

      gl.flush()
    }
    engine.raf = requestAnimationFrame(render)

    const onVisibility = (): void => {
      engine.running = !document.hidden
      engine.lastFrame = 0
    }
    document.addEventListener('visibilitychange', onVisibility)

    return (): void => {
      cancelAnimationFrame(engine.raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      for (const s of engine.meshStates) {
        gl.deleteBuffer(s.vertexBuffer)
        gl.deleteBuffer(s.indexBuffer)
        gl.deleteTexture(s.texture)
      }
      gl.deleteBuffer(quadBuffer)
      gl.deleteFramebuffer(fbo)
      gl.deleteTexture(fboTexture)
      gl.deleteProgram(mainProg.program)
      gl.deleteProgram(quadProg.program)
      canvas.remove()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!IS_H5) return
    const engine = engineRef.current
    if (!engine || !src) {
      if (engine) engine.isNoCover = true
      return
    }
    let cancelled = false
    const gl = engine.gl

    loadImage(src, engine.imgCache)
      .then((img) => {
        if (cancelled || engineRef.current !== engine) return
        const imageData = buildPaletteTexture(img)
        if (!imageData) return

        const texture = gl.createTexture()
        if (!texture) return
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT)

        const meshIdx = Math.floor(Math.random() * meshCache.length)
        const meshData = meshCache[meshIdx]

        const vertexBuffer = gl.createBuffer()
        const indexBuffer = gl.createBuffer()
        if (!vertexBuffer || !indexBuffer) return
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, meshData.vertices, gl.STATIC_DRAW)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW)

        engine.meshStates.push({
          vertexBuffer,
          indexBuffer,
          indexCount: meshData.indices.length,
          texture,
          alpha: 0,
        })
        engine.isNoCover = false
      })
      .catch(() => {
        // Cover failed — leave previous state; host bg shows through.
      })

    return (): void => {
      cancelled = true
    }
  }, [src])

  if (!IS_H5) return null

  return (
    <View
      ref={hostRef as any}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        zIndex: 0,
      }}
    />
  )
}
