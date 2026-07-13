/**
 * Admin comment management API client (Task 28).
 *
 * All helpers hit /api/admin/comments/* via the shared axios instance, which
 * injects the JWT and unwraps the response envelope. The server returns raw
 * payloads (no { code, message, data } envelope) — list returns a Paginated
 * AdminCommentListItem[], mutations return { success, count? }.
 *
 * The AdminCommentListItem shape mirrors the backend AdminCommentListItem
 * interface (apps/server/src/admin/admin-content.service.ts). It's kept here
 * rather than in @qingmalaya/shared because it's admin-only and not part of
 * the public API contract.
 */
import type { Paginated, ReportedCommentItem, UserSummary } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

export interface AdminCommentListItem {
  id: number;
  podcastId: number;
  userId: number;
  content: string;
  parentId: number | null;
  likeCount: number;
  status: string;
  createdAt: string;
  user: UserSummary;
  podcast: { id: number; title: string };
}

export interface AdminCommentListParams {
  podcastId?: number;
  userId?: number;
  keyword?: string;
  classIds?: number[];
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminBatchResult {
  success: true;
  count: number;
}

/** GET /admin/comments — paginated list with podcast/user/keyword/date filters. */
export function listAdminComments(
  params: AdminCommentListParams,
): Promise<Paginated<AdminCommentListItem>> {
  const { classIds, ...rest } = params;
  return get<Paginated<AdminCommentListItem>>('/admin/comments', {
    params: {
      ...rest,
      classIds: classIds && classIds.length > 0 ? classIds.join(',') : undefined,
    },
  });
}

/** DELETE /admin/comments/:id — delete single comment. */
export function deleteAdminComment(
  id: number,
): Promise<{ success: true }> {
  return del<{ success: true }>(`/admin/comments/${id}`);
}

/** POST /admin/comments/batch-delete — bulk delete comments. */
export function batchDeleteAdminComments(
  ids: number[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/comments/batch-delete', { ids });
}

/** GET /admin/comments/reported — pending comment reports with reporter + comment info. */
export function listReportedComments(
  classIds?: number[],
): Promise<ReportedCommentItem[]> {
  return get<ReportedCommentItem[]>('/admin/comments/reported', {
    params: {
      classIds: classIds && classIds.length > 0 ? classIds.join(',') : undefined,
    },
  });
}

/** PUT /admin/comments/:id/report/resolve — resolve a comment report (delete or dismiss). */
export function resolveReport(
  commentId: number,
  payload: { action: 'dismiss' | 'delete'; reason?: string },
): Promise<{ success: true }> {
  return put<{ success: true }>(
    `/admin/comments/${commentId}/report/resolve`,
    payload,
  );
}
