import { get, put } from '../utils/request'
import type { NotificationItem, Paginated } from '@qingmalaya/shared'

export function listNotifications(
  page: number = 1,
  pageSize: number = 20,
): Promise<Paginated<NotificationItem>> {
  return get<Paginated<NotificationItem>>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
  )
}

export function getUnreadCount(): Promise<number> {
  return get<{ count: number }>('/notifications/unread-count').then(
    (res) => res.count,
  )
}

export function markAsRead(id: number): Promise<void> {
  return put<void>(`/notifications/${id}/read`)
}

export function markAllRead(): Promise<void> {
  return put<void>('/notifications/read-all')
}
