/**
 * Admin class-management API helpers. All calls go through the shared axios
 * instance (baseURL = '/api'), so '/admin/classes' hits '/api/admin/classes'.
 */
import { get, post, put, del } from '@/utils/request';

/** Class row projected by GET /admin/classes (with user/podcast counts). */
export interface AdminClassListItem {
  id: number;
  name: string;
  grade: string;
  department: string;
  createdAt: string;
  userCount: number;
  podcastCount: number;
}

export interface AdminCreateClassPayload {
  name: string;
  grade?: string;
  department?: string;
}

export interface AdminUpdateClassPayload {
  name?: string;
  grade?: string;
  department?: string;
}

export interface ImportStudentsResult {
  created: number;
  skipped: number;
  errors: string[];
}

/** GET /admin/classes — list all classes with user/podcast counts. */
export function listAdminClasses(): Promise<AdminClassListItem[]> {
  return get<AdminClassListItem[]>('/admin/classes');
}

/** POST /admin/classes — create a new class. */
export function createAdminClass(
  payload: AdminCreateClassPayload,
): Promise<AdminClassListItem> {
  return post<AdminClassListItem>('/admin/classes', payload);
}

/** PUT /admin/classes/:id — update class name/grade/department. */
export function updateAdminClass(
  id: number,
  payload: AdminUpdateClassPayload,
): Promise<AdminClassListItem> {
  return put<AdminClassListItem>(`/admin/classes/${id}`, payload);
}

/** DELETE /admin/classes/:id — delete class (rejected if it has users). */
export function deleteAdminClass(id: number): Promise<void> {
  return del<void>(`/admin/classes/${id}`);
}

/** POST /admin/classes/:id/import — batch import students from pasted lines. */
export function importStudents(
  id: number,
  lines: string,
): Promise<ImportStudentsResult> {
  return post<ImportStudentsResult>(`/admin/classes/${id}/import`, { lines });
}
