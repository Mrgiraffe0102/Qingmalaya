import Taro from '@tarojs/taro'

/**
 * Promise-based Taro.request wrapper.
 *
 * - Injects JWT `Authorization: Bearer <token>` header when a token is present
 *   in storage.
 * - On 401: clears auth-related storage and redirects to the login page so the
 *   user can re-authenticate. We do NOT attempt a silent refresh here because
 *   the refresh token flow is handled explicitly elsewhere; a 401 means the
 *   access token is no longer valid.
 * - On other errors: surfaces a non-blocking toast so the user gets feedback.
 * - Returns the parsed response body directly (typed as T by the caller).
 */

export const API_BASE_URL = 'http://localhost:3000/api'

const TOKEN_STORAGE_KEY = 'token'
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken'
const LOGIN_PAGE = '/pages/login/index'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: Record<string, unknown> | unknown[] | string
  header?: Record<string, string>
  /** Skip the JWT header + 401 redirect (used by the login endpoint itself). */
  skipAuth?: boolean
  /** Suppress the default error toast for this call. */
  silent?: boolean
}

interface ApiErrorEnvelope {
  message?: string
  error?: string
}

function getAuthToken(): string | null {
  try {
    return Taro.getStorageSync(TOKEN_STORAGE_KEY) || null
  } catch {
    return null
  }
}

function handleUnauthorized(): void {
  try {
    Taro.removeStorageSync(TOKEN_STORAGE_KEY)
    Taro.removeStorageSync(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    // ignore storage errors during cleanup
  }
  // Use redirectTo so the login page replaces the current entry in the history
  // stack — preventing a back-button loop into an authenticated page.
  Taro.redirectTo({ url: LOGIN_PAGE })
}

function extractErrorMessage(statusCode: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const envelope = body as ApiErrorEnvelope
    if (typeof envelope.message === 'string' && envelope.message) {
      return envelope.message
    }
    if (typeof envelope.error === 'string' && envelope.error) {
      return envelope.error
    }
  }
  if (statusCode === 401) return '登录已过期，请重新登录'
  if (statusCode === 403) return '没有权限执行此操作'
  if (statusCode === 404) return '请求的资源不存在'
  if (statusCode >= 500) return '服务器繁忙，请稍后再试'
  return `请求失败 (${statusCode})`
}

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    skipAuth = false,
    silent = false
  } = options

  const finalHeader: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header
  }

  if (!skipAuth) {
    const token = getAuthToken()
    if (token) {
      finalHeader.Authorization = `Bearer ${token}`
    }
  }

  let res: Taro.request.SuccessCallbackResult<Record<string, unknown>>
  try {
    res = await Taro.request({
      url: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
      method,
      // Taro's `data` field is constrained to string | IAnyObject | ArrayBuffer.
      // Our RequestOptions.data union also allows arrays; cast to satisfy the
      // constraint — Taro itself just JSON-serializes whatever it receives.
      data: data as Taro.request.Option['data'],
      header: finalHeader,
      timeout: 15000
    })
  } catch (networkErr) {
    // Taro.request rejects on network failures / timeouts.
    const message =
      networkErr instanceof Error ? networkErr.message : '网络连接异常'
    if (!silent) {
      Taro.showToast({ title: message, icon: 'none' })
    }
    throw networkErr
  }

  const { statusCode, data: body } = res

  if (statusCode === 401) {
    // When skipAuth is set the caller intentionally made the request without
    // a token (e.g. the login-page announcement fetch). A 401 there is NOT a
    // session-expiry event, so we must not clear tokens or redirect — just
    // surface the error to the caller.
    if (!skipAuth) {
      handleUnauthorized()
    }
    const message = extractErrorMessage(statusCode, body)
    if (!silent) {
      Taro.showToast({ title: message, icon: 'none' })
    }
    throw new Error(message)
  }

  if (statusCode < 200 || statusCode >= 300) {
    const message = extractErrorMessage(statusCode, body)
    if (!silent) {
      Taro.showToast({ title: message, icon: 'none' })
    }
    throw new Error(message)
  }

  return body as T
}

export const get = <T = unknown>(
  url: string,
  opts?: Omit<RequestOptions, 'url' | 'method' | 'data'>
) => request<T>({ url, method: 'GET', ...opts })

export const post = <T = unknown>(
  url: string,
  data?: RequestOptions['data'],
  opts?: Omit<RequestOptions, 'url' | 'method' | 'data'>
) => request<T>({ url, method: 'POST', data, ...opts })

export const put = <T = unknown>(
  url: string,
  data?: RequestOptions['data'],
  opts?: Omit<RequestOptions, 'url' | 'method' | 'data'>
) => request<T>({ url, method: 'PUT', data, ...opts })

export const del = <T = unknown>(
  url: string,
  opts?: Omit<RequestOptions, 'url' | 'method' | 'data'>
) => request<T>({ url, method: 'DELETE', ...opts })
