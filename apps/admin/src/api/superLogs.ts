/**
 * Admin super-log API — SUPER_ADMIN only.
 * Returns paginated UserActivityLog rows with the acting user's info joined in.
 */
import { get } from '@/utils/request';
import type { Paginated, UserActivityLogWithUser } from '@qingmalaya/shared';

export type SuperLogItem = UserActivityLogWithUser;

export interface SuperLogsQuery {
  userId?: number;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const listSuperLogs = (
  params: SuperLogsQuery,
): Promise<Paginated<SuperLogItem>> =>
  get<Paginated<SuperLogItem>>('/admin/super-logs', { params });
