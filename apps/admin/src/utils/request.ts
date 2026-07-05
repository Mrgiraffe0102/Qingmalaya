/**
 * Axios instance with JWT injection and 401 handling.
 * All admin API calls should go through these helpers so auth flow stays centralized.
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getToken, clearToken } from '@/store/auth';

export interface ApiResult<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Request interceptor: inject Bearer token ---
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// --- Response interceptor: unwrap data, handle 401 ---
request.interceptors.response.use(
  (response: AxiosResponse<ApiResult | unknown>) => {
    // If backend wraps in { code, message, data }, unwrap; otherwise return raw.
    const payload = response.data;
    if (
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      'data' in payload
    ) {
      const result = payload as ApiResult;
      if (result.code !== 0 && result.code !== 200) {
        return Promise.reject(
          new Error(result.message || '请求失败'),
        ) as never;
      }
      return result.data as never;
    }
    return payload as never;
  },
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearToken();
      // Avoid infinite redirect loops if already on /login.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const message =
      error?.response?.data?.message || error?.message || '网络异常';
    return Promise.reject(new Error(message));
  },
);

// --- Typed helpers ---
export function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.get(url, config) as unknown as Promise<T>;
}

export function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.post(url, data, config) as unknown as Promise<T>;
}

export function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.put(url, data, config) as unknown as Promise<T>;
}

export function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.delete(url, config) as unknown as Promise<T>;
}

export default request;
