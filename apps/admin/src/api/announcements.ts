/**
 * Admin announcement management API client (Task 31).
 *
 * All helpers hit /api/admin/announcements/* via the shared axios instance,
 * which injects the JWT and unwraps the response envelope.
 */
import type { Announcement, AnnouncementStatus } from '@qingmalaya/shared';
import { del, get, post, put } from '@/utils/request';

export interface AnnouncementCreatePayload {
  title: string;
  content: string;
  status?: AnnouncementStatus;
}

export type AnnouncementUpdatePayload = Partial<AnnouncementCreatePayload>;

export function listAnnouncements(): Promise<Announcement[]> {
  return get<Announcement[]>('/admin/announcements');
}

export function createAnnouncement(
  payload: AnnouncementCreatePayload,
): Promise<Announcement> {
  return post<Announcement>('/admin/announcements', payload);
}

export function updateAnnouncement(
  id: number,
  payload: AnnouncementUpdatePayload,
): Promise<Announcement> {
  return put<Announcement>(`/admin/announcements/${id}`, payload);
}

export function deleteAnnouncement(id: number): Promise<{ id: number }> {
  return del<{ id: number }>(`/admin/announcements/${id}`);
}
