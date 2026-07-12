/**
 * Pure formatting helpers shared across pages.
 */
import { STATIC_ORIGIN } from '../config/env'

/**
 * Resolve a backend-served cover path into a usable image URL.
 * - Absolute http(s) URLs pass through unchanged.
 * - Paths starting with `/static` are prefixed with the API origin.
 * - Relative paths (e.g. `uploads/2024/07/x.jpg`) are prefixed with `/static`.
 * - Empty/null/undefined → empty string (caller renders a placeholder).
 */
export function coverUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/static')) return `${STATIC_ORIGIN}${path}`
  if (path.startsWith('/')) return `${STATIC_ORIGIN}/static${path}`
  return `${STATIC_ORIGIN}/static/${path}`
}

/**
 * Format a duration in seconds as `m:ss` or `h:mm:ss`.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Compact count formatting (Chinese convention): 1k+ → `1.2k`, 1w+ → `1.2w`.
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

/**
 * Render an ISO date string as a concise Chinese relative time.
 * - <60s → 刚刚
 * - <60m → x分钟前
 * - <24h → x小时前
 * - <30d → x天前
 * - older → M月D日 (falls back to YYYY年M月D日 for a different year)
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}天前`
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
