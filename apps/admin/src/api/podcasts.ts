/**
 * Admin podcast management API client (Tasks 27 + 28).
 *
 * All helpers hit /api/admin/podcasts/* via the shared axios instance, which
 * injects the JWT and unwraps the response envelope. The server returns raw
 * payloads (no { code, message, data } envelope) — list/detail return the
 * shared PodcastWithRelations shape, mutations return { success, count? }.
 */
import type {
  Paginated,
  PodcastStatus,
  PodcastWithRelations,
  Tag,
  FlaggedPodcastItem,
} from '@qingmalaya/shared';
import { COMMON_REJECT_REASONS, REJECT_REASON_CATEGORIES } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

export { COMMON_REJECT_REASONS, REJECT_REASON_CATEGORIES };

export interface AdminPodcastListParams {
  keyword?: string;
  status?: PodcastStatus;
  classIds?: number[];
  page?: number;
  pageSize?: number;
}

export interface AdminPodcastUpdatePayload {
  title?: string;
  description?: string;
  coverPath?: string;
  tagIds?: number[];
}

export interface AdminBatchResult {
  success: true;
  count: number;
}

/** GET /admin/podcasts — paginated list with keyword + status filter. */
export function listAdminPodcasts(
  params: AdminPodcastListParams,
): Promise<Paginated<PodcastWithRelations>> {
  const { classIds, ...rest } = params;
  return get<Paginated<PodcastWithRelations>>('/admin/podcasts', {
    params: {
      ...rest,
      classIds: classIds && classIds.length > 0 ? classIds.join(',') : undefined,
    },
  });
}

/** GET /admin/podcasts/:id — detail with author + tags + commentCount. */
export function getAdminPodcast(
  id: number,
): Promise<PodcastWithRelations> {
  return get<PodcastWithRelations>(`/admin/podcasts/${id}`);
}

/** GET /admin/podcasts/options — lightweight id+title list for selectors. */
export function listPodcastOptions(): Promise<{ id: number; title: string }[]> {
  return get<{ id: number; title: string }[]>('/admin/podcasts/options');
}

/** PUT /admin/podcasts/:id — edit metadata (title/description/coverPath/tagIds). */
export function updateAdminPodcast(
  id: number,
  payload: AdminPodcastUpdatePayload,
): Promise<PodcastWithRelations> {
  return put<PodcastWithRelations>(`/admin/podcasts/${id}`, payload);
}

/** PUT /admin/podcasts/:id/takedown — set status TAKEN_DOWN. */
export function takedownAdminPodcast(
  id: number,
): Promise<{ success: true }> {
  return put<{ success: true }>(`/admin/podcasts/${id}/takedown`);
}

/** PUT /admin/podcasts/:id/publish — set status PUBLISHED + publishedAt = now. */
export function publishAdminPodcast(
  id: number,
): Promise<{ success: true }> {
  return put<{ success: true }>(`/admin/podcasts/${id}/publish`);
}

/** POST /admin/podcasts/batch-takedown — bulk set status TAKEN_DOWN. */
export function batchTakedownAdminPodcasts(
  ids: number[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/podcasts/batch-takedown', { ids });
}

/** POST /admin/podcasts/batch-publish — bulk set status PUBLISHED (审核通过). */
export function batchPublishAdminPodcasts(
  ids: number[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/podcasts/batch-publish', { ids });
}

/** POST /admin/podcasts/batch-tag — bulk add tags (merge, no replace). */
export function batchTagAdminPodcasts(
  ids: number[],
  tagIds: number[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/podcasts/batch-tag', { ids, tagIds });
}

/** DELETE /admin/podcasts/:id — hard-delete a single podcast. */
export function deleteAdminPodcast(id: number): Promise<void> {
  return del<void>(`/admin/podcasts/${id}`);
}

/** POST /admin/podcasts/batch-delete — bulk hard-delete podcasts. */
export function batchDeleteAdminPodcasts(
  ids: number[],
): Promise<AdminBatchResult> {
  return post<AdminBatchResult>('/admin/podcasts/batch-delete', { ids });
}

/**
 * GET /admin/podcasts/flagged — list FLAGGED podcasts with flag reason +
 * reviewer. Optionally filtered by classIds (teacher scope).
 */
export function listFlaggedPodcasts(
  classIds?: number[],
): Promise<FlaggedPodcastItem[]> {
  return get<FlaggedPodcastItem[]>('/admin/podcasts/flagged', {
    params: {
      classIds: classIds && classIds.length > 0 ? classIds.join(',') : undefined,
    },
  });
}

/**
 * PUT /admin/podcasts/:id/reject — reject a podcast with a reason. Sets
 * status TAKEN_DOWN and creates a PodcastReview (action=REJECT).
 */
export function rejectAdminPodcast(
  id: number,
  payload: { reasonTags?: number[]; reason?: string },
): Promise<{ success: true }> {
  return put<{ success: true }>(`/admin/podcasts/${id}/reject`, payload);
}

/**
 * GET /tags — all tags ordered by weight. Used to populate the tag selector
 * in the podcast edit modal and the batch-tag modal. Hits the public /tags
 * endpoint (not /admin/tags) because the admin tag CRUD is a separate task;
 * the public endpoint is already implemented and returns the same Tag shape.
 */
export function listAllTags(): Promise<Tag[]> {
  return get<Tag[]>('/tags');
}
