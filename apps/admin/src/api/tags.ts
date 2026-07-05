/**
 * Admin tag management API client (Task 29).
 *
 * All helpers hit /api/admin/tags/* via the shared axios instance, which
 * injects the JWT and unwraps the response envelope. The server returns
 * TagWithCount (Tag + podcastCount) for the list endpoint and plain Tag
 * for create/update.
 */
import type { Tag } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

/** Tag row with the count of PodcastTag references (admin list endpoint). */
export interface TagWithCount extends Tag {
  podcastCount: number;
}

export interface TagCreatePayload {
  name: string;
  weight?: number;
  color?: Tag['color'];
}

export type TagUpdatePayload = Partial<TagCreatePayload>;

export function listTags(): Promise<TagWithCount[]> {
  return get<TagWithCount[]>('/admin/tags');
}

export function createTag(payload: TagCreatePayload): Promise<Tag> {
  return post<Tag>('/admin/tags', payload);
}

export function updateTag(id: number, payload: TagUpdatePayload): Promise<Tag> {
  return put<Tag>(`/admin/tags/${id}`, payload);
}

export function deleteTag(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/tags/${id}`);
}
