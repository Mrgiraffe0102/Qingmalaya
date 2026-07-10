import type { UploadedFile } from '@qingmalaya/shared';
import { del, get, post } from '@/utils/request';

export interface ImageUploadResult {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimetype: string;
}

export interface UploadListResult {
  items: UploadedFile[];
  total: number;
  page: number;
  pageSize: number;
}

export function uploadImage(file: File): Promise<ImageUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return post<ImageUploadResult>('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function listUploads(
  page = 1,
  pageSize = 24,
): Promise<UploadListResult> {
  return get<UploadListResult>('/admin/uploads', {
    params: { page, pageSize },
  });
}

export function deleteUpload(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/uploads/${id}`);
}
