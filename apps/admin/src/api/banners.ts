/**
 * Admin banner management API client (Task 30).
 *
 * All helpers hit /api/admin/banners/* via the shared axios instance, which
 * injects the JWT and unwraps the response envelope.
 */
import type { Banner, BannerLinkType, BannerStatus } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

export interface BannerCreatePayload {
  title: string;
  coverPath: string;
  linkType?: BannerLinkType;
  linkTarget?: string;
  sort?: number;
  status?: BannerStatus;
  startAt?: string;
  endAt?: string;
}

export type BannerUpdatePayload = Partial<BannerCreatePayload>;

export function listBanners(): Promise<Banner[]> {
  return get<Banner[]>('/admin/banners');
}

export function createBanner(payload: BannerCreatePayload): Promise<Banner> {
  return post<Banner>('/admin/banners', payload);
}

export function updateBanner(
  id: number,
  payload: BannerUpdatePayload,
): Promise<Banner> {
  return put<Banner>(`/admin/banners/${id}`, payload);
}

export function deleteBanner(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/banners/${id}`);
}

export function updateBannerSort(id: number, sort: number): Promise<Banner> {
  return put<Banner>(`/admin/banners/${id}/sort`, { sort });
}
