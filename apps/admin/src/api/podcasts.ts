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
} from '@qingmalaya/shared';
import { get, post, put } from '@/utils/request';

export interface AdminPodcastListParams {
  keyword?: string;
  status?: PodcastStatus;
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
  return get<Paginated<PodcastWithRelations>>('/admin/podcasts', { params });
}

/** GET /admin/podcasts/:id — detail with author + tags + commentCount. */
export function getAdminPodcast(
  id: number,
): Promise<PodcastWithRelations> {
  return get<PodcastWithRelations>(`/admin/podcasts/${id}`);
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

/**
 * GET /tags — all tags ordered by weight. Used to populate the tag selector
 * in the podcast edit modal and the batch-tag modal. Hits the public /tags
 * endpoint (not /admin/tags) because the admin tag CRUD is a separate task;
 * the public endpoint is already implemented and returns the same Tag shape.
 */
export function listAllTags(): Promise<Tag[]> {
  return get<Tag[]>('/tags');
}
