/**
 * Admin auth API client.
 *
 * All calls go through the shared axios instance (baseURL '/api'), so
 * `loginAdmin` hits `/api/admin/auth/login` which Vite proxies to the
 * NestJS server. The response interceptor unwraps any envelope and the
 * error interceptor surfaces `message` from the backend body.
 */
import { post } from '@/utils/request';
import type { LoginResponse } from '@qingmalaya/shared';

export interface AdminLoginPayload {
  username: string;
  password: string;
}

/**
 * POST /admin/auth/login — validates OPERATOR/SUPER_ADMIN credentials and
 * returns access + refresh JWTs plus the safe User object.
 */
export function loginAdmin(payload: AdminLoginPayload): Promise<LoginResponse> {
  return post<LoginResponse>('/admin/auth/login', payload);
}
