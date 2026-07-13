/**
 * Admin user-management API helpers. All calls go through the shared axios
 * instance (baseURL = '/api'), so '/admin/users' hits '/api/admin/users'.
 * NestJS returns raw payloads (no { code, message, data } envelope).
 */
import type { ManagedClassesResponse, Paginated, Role, UserStatus } from '@qingmalaya/shared';
import { del, get, put, post } from '@/utils/request';

/** Serialize a number[] to a comma-separated string for query params. */
function joinClassIds(classIds?: number[]): string | undefined {
  return classIds && classIds.length > 0 ? classIds.join(',') : undefined;
}

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
  classIds?: number[];
  roles?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateUserPayload {
  studentId: string;
  name: string;
  password: string;
  role: 'STUDENT' | 'TEACHER';
  classId?: number;
  managedClassIds?: number[];
  manageAllClasses?: boolean;
}

export interface ResetPasswordResult {
  newPassword: string;
}

/** GET /admin/users — paginated list with keyword + classId filter. */
export function listAdminUsers(
  params: AdminUsersListParams,
): Promise<Paginated<AdminUserListItem>> {
  const { classIds, ...rest } = params;
  return get<Paginated<AdminUserListItem>>('/admin/users', {
    params: { ...rest, classIds: joinClassIds(classIds) },
  });
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

/** DELETE /admin/users/:id — delete a single user (STUDENT/TEACHER only). */
export function deleteUser(id: number): Promise<void> {
  return del<void>(`/admin/users/${id}`);
}

export interface BatchDeleteUsersResult {
  success: true;
  count: number;
  skipped: number;
}

/** POST /admin/users/batch-delete — bulk delete users (STUDENT/TEACHER only). */
export function batchDeleteUsers(
  ids: number[],
): Promise<BatchDeleteUsersResult> {
  return post<BatchDeleteUsersResult>('/admin/users/batch-delete', { ids });
}

/** GET /admin/me/managed-classes — current user's managed classes (teachers). */
export function getManagedClasses(): Promise<ManagedClassesResponse> {
  return get<ManagedClassesResponse>('/admin/me/managed-classes');
}

/** GET /admin/users/:id/managed-classes — a specific teacher's managed classes. */
export function getUserManagedClasses(
  userId: number,
): Promise<ManagedClassesResponse> {
  return get<ManagedClassesResponse>(`/admin/users/${userId}/managed-classes`);
}

/** PUT /admin/users/:id/managed-classes — set a teacher's managed classes. */
export function updateUserManagedClasses(
  userId: number,
  payload: { classIds: number[]; manageAllClasses: boolean },
): Promise<ManagedClassesResponse> {
  return put<ManagedClassesResponse>(
    `/admin/users/${userId}/managed-classes`,
    payload,
  );
}
