import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore, isAuthenticated } from '../store/auth'

/**
 * Route guard helpers.
 *
 * Taro doesn't expose global route interceptors, so auth gating is enforced
 * per-page: protected pages call `useAuthRedirect()` on mount and bail out of
 * rendering until the redirect completes.
 *
 * IMPORTANT: Zustand's `persist` middleware rehydrates asynchronously (even
 * with sync storage, the rehydrate runs in a microtask). So we MUST wait for
 * `hasHydrated()` before checking auth — otherwise the store still holds its
 * initial `null` state and every page reload would falsely redirect to login.
 */

const LOGIN_PAGE = '/pages/login/index'
const CHANGE_PASSWORD_PAGE = '/pages/change-password/index'

export function requireAuth(): boolean {
  const state = useAuthStore.getState()
  if (!isAuthenticated(state)) {
    Taro.redirectTo({ url: LOGIN_PAGE })
    return false
  }
  if (state.mustChangePassword) {
    Taro.redirectTo({ url: CHANGE_PASSWORD_PAGE })
    return false
  }
  return true
}

/**
 * React hook for protected pages. Returns `true` once it's safe to render.
 * Waits for the Zustand persist store to finish rehydrating from storage
 * before running the auth check, so a page reload doesn't falsely redirect
 * to login.
 *
 * Usage:
 *   const ok = useAuthRedirect()
 *   if (!ok) return null
 */
export function useAuthRedirect(): boolean {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const check = () => {
      if (!useAuthStore.persist.hasHydrated()) return
      setOk(requireAuth())
    }

    check()
    // If hydration hasn't finished yet, onFinishHydration will call check
    // once it does.
    const unsub = useAuthStore.persist.onFinishHydration(check)
    return unsub
  }, [])

  return ok
}
