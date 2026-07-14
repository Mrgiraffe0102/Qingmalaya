/**
 * Centralized runtime configuration for the mobile app.
 *
 * `__API_BASE_URL__` and `__STATIC_ORIGIN__` are injected at build time by
 * Taro's `defineConstants` (see apps/mobile/config/index.ts). The values
 * default to the local Docker dev server, but production builds set them via
 * `API_BASE_URL` / `STATIC_ORIGIN` env vars (or the Dockerfile `ARG`s) so the
 * bundled H5 / WeApp points at the real server.
 *
 * Build examples:
 *   # Local dev (H5)
 *   pnpm dev:h5
 *   # Production H5 pointing at the real domain
 *   API_BASE_URL=https://qhfzwjhx.cn/api \
 *   STATIC_ORIGIN=https://qhfzwjhx.cn \
 *     pnpm build:h5
 *   # WeChat mini-program (must be HTTPS, and the domain must be added to the
 *   # WeChat MP dashboard as a request / uploadFile legal domain)
 *   API_BASE_URL=https://qhfzwjhx.cn/api \
 *   STATIC_ORIGIN=https://qhfzwjhx.cn \
 *     pnpm build:weapp
 */
declare const __API_BASE_URL__: string
declare const __STATIC_ORIGIN__: string

export const API_BASE_URL: string =
  typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__
    ? __API_BASE_URL__
    : 'http://localhost:3000/api'

export const STATIC_ORIGIN: string =
  typeof __STATIC_ORIGIN__ === 'string' && __STATIC_ORIGIN__
    ? __STATIC_ORIGIN__
    : 'http://localhost:3000'

/**
 * App version info — bumped manually when a new APK is built.
 * The server's AppRelease records use the same version/versionCode to
 * trigger update prompts on Android and "已更新" popups on H5.
 */
export const APP_VERSION = '1.0.0'
export const APP_VERSION_CODE = 1
