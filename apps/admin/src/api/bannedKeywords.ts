/**
 * Admin banned-keyword management API client.
 *
 * All helpers hit /api/admin/banned-keywords/* via the shared axios instance,
 * which injects the JWT and unwraps the response envelope.
 *
 * The BannedKeyword shape mirrors the backend response (see
 * AdminBannedKeywordsService.list). Kept here rather than in @qingmalaya/shared
 * because it's admin-only and not part of the public API contract.
 */
import { del, get, post } from '@/utils/request';

export interface BannedKeyword {
  id: number;
  keyword: string;
  createdAt: string;
}

export interface AdminBatchResult {
  success: true;
  count: number;
}

/** GET /admin/banned-keywords — list all banned keywords, newest first. */
export function listBannedKeywords(): Promise<BannedKeyword[]> {
  return get<BannedKeyword[]>('/admin/banned-keywords');
}

/** POST /admin/banned-keywords — batch-create keywords (duplicates skipped). */
export function createBannedKeywords(
  keywords: string[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/banned-keywords', { keywords });
}

/** DELETE /admin/banned-keywords/:id — delete a single keyword. */
export function deleteBannedKeyword(
  id: number,
): Promise<{ success: true }> {
  return del<{ success: true }>(`/admin/banned-keywords/${id}`);
}
