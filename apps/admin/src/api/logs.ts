/**
 * Admin audit log API (Task 33).
 * Returns paginated AdminLog rows with the acting admin's name joined in.
 */
import { get } from '@/utils/request';
import type { Paginated } from '@qingmalaya/shared';

export interface AdminLogItem {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  detail: unknown;
  createdAt: string;
}

export interface LogsQuery {
  adminId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const listLogs = (params: LogsQuery): Promise<Paginated<AdminLogItem>> =>
  get<Paginated<AdminLogItem>>('/admin/logs', { params });
