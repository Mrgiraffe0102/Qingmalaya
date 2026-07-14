/**
 * Admin app release management API client.
 *
 * All helpers hit /api/admin/releases/* via the shared axios instance,
 * which injects the JWT and unwraps the response envelope.
 */
import type { AppRelease } from '@qingmalaya/shared';
import { del, get, post } from '@/utils/request';

export interface ReleaseCreatePayload {
  version: string;
  versionCode: number;
  updateContent: string;
  apkPath?: string;
}

export interface ApkUploadResult {
  path: string;
  size: number;
  originalName: string;
}

export function listReleases(): Promise<AppRelease[]> {
  return get<AppRelease[]>('/admin/releases');
}

export function createRelease(
  payload: ReleaseCreatePayload,
): Promise<AppRelease> {
  return post<AppRelease>('/admin/releases', payload);
}

export function deleteRelease(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/releases/${id}`);
}

export function uploadApk(file: File): Promise<ApkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return post<ApkUploadResult>('/admin/releases/upload-apk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min timeout for large APK files
  });
}
