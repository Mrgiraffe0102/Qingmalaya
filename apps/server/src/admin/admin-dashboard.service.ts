import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shape of the dashboard stats response. The admin frontend reads these
 * fields directly — types are kept inline here (not in @qingmalaya/shared)
 * because they're admin-only and not part of the public API contract.
 */
export interface DashboardStats {
  cards: {
    totalUsers: number;
    totalPodcasts: number;
    pendingReview: number;
    todayUploads: number;
    todayPlays: number;
    totalLikes: number;
  };
  uploadTrend: { date: string; count: number }[];
  playTrend: { date: string; count: number }[];
  classActivity: { className: string; podcastCount: number; userCount: number }[];
  topPodcasts: {
    id: number;
    title: string;
    coverPath: string | null;
    playCount: number;
    likeCount: number;
    authorName: string;
  }[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function date30DaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 29); // 29 days ago + today = 30 days
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as YYYY-MM-DD (local time, for trend grouping). */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build a 30-element date array from 29 days ago through today. */
function build30DayBuckets(): string[] {
  const buckets: string[] = [];
  const start = date30DaysAgo();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.push(formatDate(d));
  }
  return buckets;
}

/**
 * Dashboard aggregate service. Computes the 5 stat cards, 30-day upload/play
 * trends (grouped in JS to avoid MySQL date-trunc complexity), class activity,
 * and top-10 podcasts by play count.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const today = startOfToday();
    const thirtyDaysAgo = date30DaysAgo();

    const [
      totalUsers,
      totalPodcasts,
      pendingReview,
      todayUploads,
      todayPlays,
      totalLikes,
      recentPodcasts,
      recentPlayHistory,
      classActivityRows,
      topPodcasts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.podcast.count(),
      this.prisma.podcast.count({ where: { status: 'PENDING' } }),
      this.prisma.podcast.count({ where: { createdAt: { gte: today } } }),
      this.prisma.playHistory.count({ where: { playedAt: { gte: today } } }),
      this.prisma.like.count({ where: { targetType: 'PODCAST' } }),
      this.prisma.podcast.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.playHistory.findMany({
        where: { playedAt: { gte: thirtyDaysAgo } },
        select: { playedAt: true },
      }),
      this.prisma.class.findMany({
        select: {
          name: true,
          _count: { select: { podcasts: true, users: true } },
        },
        orderBy: { podcasts: { _count: 'desc' } },
      }),
      this.prisma.podcast.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { playCount: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          coverPath: true,
          playCount: true,
          likeCount: true,
          author: { select: { name: true } },
        },
      }),
    ]);

    // Build trend maps keyed by YYYY-MM-DD.
    const buckets = build30DayBuckets();
    const uploadMap = new Map<string, number>();
    const playMap = new Map<string, number>();
    for (const b of buckets) {
      uploadMap.set(b, 0);
      playMap.set(b, 0);
    }
    for (const p of recentPodcasts) {
      const key = formatDate(p.createdAt);
      if (uploadMap.has(key)) uploadMap.set(key, (uploadMap.get(key) ?? 0) + 1);
    }
    for (const h of recentPlayHistory) {
      const key = formatDate(h.playedAt);
      if (playMap.has(key)) playMap.set(key, (playMap.get(key) ?? 0) + 1);
    }

    return {
      cards: {
        totalUsers,
        totalPodcasts,
        pendingReview,
        todayUploads,
        todayPlays,
        totalLikes,
      },
      uploadTrend: buckets.map((date) => ({ date, count: uploadMap.get(date) ?? 0 })),
      playTrend: buckets.map((date) => ({ date, count: playMap.get(date) ?? 0 })),
      classActivity: classActivityRows.map((c) => ({
        className: c.name,
        podcastCount: c._count.podcasts,
        userCount: c._count.users,
      })),
      topPodcasts: topPodcasts.map((p) => ({
        id: p.id,
        title: p.title,
        coverPath: p.coverPath,
        playCount: p.playCount,
        likeCount: p.likeCount,
        authorName: p.author.name,
      })),
    };
  }
}
