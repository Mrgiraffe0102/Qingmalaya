/**
 * Admin dashboard API client.
 *
 * The DashboardStats shape mirrors the backend AdminDashboardService response
 * (apps/server/src/admin/admin-dashboard.service.ts). It's kept here rather
 * than in @qingmalaya/shared because it's admin-only and not part of the
 * public API contract, matching the backend's own convention.
 */
import { get } from '@/utils/request';

export interface DashboardCards {
  totalUsers: number;
  totalPodcasts: number;
  pendingReview: number;
  todayUploads: number;
  todayPlays: number;
  totalLikes: number;
}

export interface DashboardTrendPoint {
  date: string;
  count: number;
}

export interface DashboardClassActivity {
  className: string;
  podcastCount: number;
  userCount: number;
}

export interface DashboardTopPodcast {
  id: number;
  title: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  authorName: string;
}

export interface DashboardStats {
  cards: DashboardCards;
  uploadTrend: DashboardTrendPoint[];
  playTrend: DashboardTrendPoint[];
  classActivity: DashboardClassActivity[];
  topPodcasts: DashboardTopPodcast[];
}

/**
 * GET /admin/dashboard/stats — 5 stat cards, 30-day upload/play trends,
 * class activity, and top-10 podcasts. Requires OPERATOR+ role (enforced
 * server-side by RolesGuard).
 */
export function getDashboardStats(): Promise<DashboardStats> {
  return get<DashboardStats>('/admin/dashboard/stats');
}
