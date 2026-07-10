import { useEffect, useState } from 'react'

/** Desktop breakpoint (px) — at/above this the top menu replaces the floating island. */
const DESKTOP_BREAKPOINT = 800

/**
 * Returns true on H5 when the viewport is >= 1024px wide.
 * Mini-program / RN builds have no `window`, so they always report false
 * (the floating-island nav is the only layout there).
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isDesktop
}
