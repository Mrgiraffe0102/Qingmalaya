/**
 * Admin user-management API helpers. All calls go through the shared axios
 * instance (baseURL = '/api'), so '/admin/users' hits '/api/admin/users'.
 * NestJS returns raw payloads (no { code, message, data } envelope).
 */
import type { Paginated, Role, UserStatus } from '@qingmalaya/shared';
import { get, put, post } from '@/utils/request';

/** User row projected by GET /admin/users (extends shared User with admin extras). */
export interface AdminUserListItem {
  id: number;
  studentId: string;
  name: string;
  classId: number | null;
  role: Role;
  avatar: string | null;
  bio: string | null;
  totalListens: number;
  totalLikes: number;
  status: UserStatus;
  firstLogin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  className: string | null;
  totalPodcasts: number;
}

export interface AdminUsersListParams {
  keyword?: string;
  classId?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateUserPayload {
  studentId: string;
  name: string;
  password: string;
  role: 'STUDENT' | 'TEACHER';
  classId?: number;
}

export interface ResetPasswordResult {
  newPassword: string;
}

/** GET /admin/users — paginated list with keyword + classId filter. */
export function listAdminUsers(
  params: AdminUsersListParams,
): Promise<Paginated<AdminUserListItem>> {
  return get<Paginated<AdminUserListItem>>('/admin/users', { params });
}

/** POST /admin/users — create a new STUDENT or TEACHER account. */
export function createUser(payload: CreateUserPayload): Promise<AdminUserListItem> {
  return post<AdminUserListItem>('/admin/users', payload);
}

/** PUT /admin/users/:id/ban — set status BANNED. */
export function banUser(id: number): Promise<void> {
  return put<void>(`/admin/users/${id}/ban`);
}

/** PUT /admin/users/:id/unban — set status ACTIVE. */
export function unbanUser(id: number): Promise<void> {
  return put<void>(`/admin/users/${id}/unban`);
}

/** POST /admin/users/:id/reset-password — reset to studentId-derived password. */
export function resetUserPassword(id: number): Promise<ResetPasswordResult> {
  return post<ResetPasswordResult>(`/admin/users/${id}/reset-password`);
}
