import type { BannerStatus } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

export interface CollectionListItem {
  id: number;
  title: string;
  description: string | null;
  coverPath: string | null;
  sort: number;
  status: BannerStatus;
  createdAt: string;
  updatedAt: string;
  podcastCount: number;
}

export interface CollectionCreatePayload {
  title: string;
  description?: string;
  coverPath?: string;
  podcastIds: number[];
  sort?: number;
  status?: BannerStatus;
}

export type CollectionUpdatePayload = Partial<CollectionCreatePayload>;

export interface CollectionDetail extends CollectionListItem {
  podcastIds: number[];
}

export function listCollections(): Promise<CollectionListItem[]> {
  return get<CollectionListItem[]>('/admin/collections');
}

export function getCollectionDetail(
  id: number,
): Promise<CollectionDetail> {
  return get<CollectionDetail>(`/admin/collections/${id}`);
}

export function createCollection(
  payload: CollectionCreatePayload,
): Promise<CollectionListItem> {
  return post<CollectionListItem>('/admin/collections', payload);
}

export function updateCollection(
  id: number,
  payload: CollectionUpdatePayload,
): Promise<CollectionListItem> {
  return put<CollectionListItem>(`/admin/collections/${id}`, payload);
}

export function deleteCollection(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/collections/${id}`);
}
