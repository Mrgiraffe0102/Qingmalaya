/**
 * Admin account management API (Task 32).
 * All routes are SUPER_ADMIN-only on the backend.
 */
import { get, post, put, del } from '@/utils/request';
import type { Role, User } from '@qingmalaya/shared';

export type AdminRole = Extract<Role, 'OPERATOR' | 'SUPER_ADMIN'>;

export interface CreateAdminPayload {
  studentId: string;
  name: string;
  password: string;
  role: AdminRole;
}

export interface UpdateAdminPayload {
  name?: string;
  role?: AdminRole;
  password?: string;
}

export const listAdmins = (): Promise<User[]> => get<User[]>('/admin/admins');

export const createAdmin = (data: CreateAdminPayload): Promise<User> =>
  post<User>('/admin/admins', data);

export const updateAdmin = (id: number, data: UpdateAdminPayload): Promise<User> =>
  put<User>(`/admin/admins/${id}`, data);

export const deleteAdmin = (id: number): Promise<void> =>
  del<void>(`/admin/admins/${id}`);
