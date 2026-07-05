import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import type { User } from '@qingmalaya/shared'

/**
 * Auth store (Zustand + persist).
 *
 * - `token` (access token) lives in the persisted store so the auth state
 *   survives reloads. The refresh token is intentionally kept OUT of the store
 *   (it's only used in the rare refresh flow) and stored directly in Taro
 *   storage under `refreshToken`.
 * - `isAuthenticated` is a computed getter derived from `token && user` so it
 *   can never drift out of sync with the actual state.
 * - The custom Taro storage adapter lets `persist` work across H5 / WeApp / RN
 *   without touching localStorage directly.
 */

const TOKEN_STORAGE_KEY = 'token'
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken'
const AUTH_STORE_STORAGE_KEY = 'qingmalaya-auth'

/**
 * Zustand persist adapter backed by Taro sync storage.
 *
 * IMPORTANT: Taro's `getStorageSync` on H5 auto-deserializes JSON strings
 * (e.g. `{"data":"..."}` is unwrapped and parsed), returning an OBJECT
 * instead of the raw string. But Zustand's `createJSONStorage` calls
 * `JSON.parse(getItem(...))` — so it expects a STRING. If we hand it an
 * object, `JSON.parse` sees `"[object Object]"` and throws, silently
 * breaking store hydration (pages guarded by `useAuthRedirect` never render).
 *
 * The fix: `getItem` normalizes the value back to a string. If Taro already
 * parsed it into an object, we re-stringify; if it's already a string we pass
 * it through; if it's falsy we return null.
 */
const taroStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      const val = Taro.getStorageSync(name)
      if (!val) return null
      return typeof val === 'string' ? val : JSON.stringify(val)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      Taro.setStorageSync(name, value)
    } catch {
      // ignore quota / serialization errors
    }
  },
  removeItem: (name: string): void => {
    try {
      Taro.removeStorageSync(name)
    } catch {
      // ignore
    }
  }
}

export interface SetAuthPayload {
  user: User
  accessToken: string
  refreshToken: string
  mustChangePassword: boolean
}

export interface AuthState {
  user: User | null
  token: string | null
  mustChangePassword: boolean
  setAuth: (data: SetAuthPayload) => void
  clearAuth: () => void
  loadFromStorage: () => void
  updateUser: (partial: Partial<User>) => void
  setMustChangePassword: (value: boolean) => void
}

/**
 * Compute `isAuthenticated` from the raw state fields.
 *
 * NOTE: We deliberately do NOT use a JS getter on the store state. Zustand's
 * `persist` merge and `set` both spread the state object (`{ ...state, ...partial }`),
 * which evaluates getters and copies the RESULT (a plain boolean) — the getter
 * itself is lost. That left `isAuthenticated` stuck at its initial `false`
 * forever, breaking the route guard. Computing it explicitly at every call site
 * avoids this pitfall.
 */
export function isAuthenticated(state: AuthState): boolean {
  return !!state.token && !!state.user
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      mustChangePassword: false,
      setAuth: (data) => {
        const { user, accessToken, refreshToken, mustChangePassword } = data
        // Persist the refresh token separately — it's read only by the refresh
        // flow, not by React components, so it doesn't belong in the store.
        try {
          Taro.setStorageSync(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
        } catch {
          // ignore
        }
        set({ user, token: accessToken, mustChangePassword })
      },
      clearAuth: () => {
        try {
          Taro.removeStorageSync(TOKEN_STORAGE_KEY)
          Taro.removeStorageSync(REFRESH_TOKEN_STORAGE_KEY)
        } catch {
          // ignore
        }
        set({ user: null, token: null, mustChangePassword: false })
      },
      loadFromStorage: () => {
        // The persist middleware rehydrates automatically on store creation,
        // but on H5 reload the access token is also mirrored under the legacy
        // `token` key by request.ts. Honor that key as a fallback so a user
        // who logged in before this store existed stays signed in.
        const state = get()
        if (state.token) return
        try {
          const legacyToken = Taro.getStorageSync(TOKEN_STORAGE_KEY)
          if (legacyToken) {
            set({ token: legacyToken as string })
          }
        } catch {
          // ignore
        }
      },
      updateUser: (partial) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, ...partial } })
      },
      setMustChangePassword: (value) => set({ mustChangePassword: value })
    }),
    {
      name: AUTH_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => taroStorage),
      // Only persist the data, not the actions or computed getter.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        mustChangePassword: state.mustChangePassword
      })
    }
  )
)
