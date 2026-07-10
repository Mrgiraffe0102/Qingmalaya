import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  NotificationItem,
  NotificationType,
  Paginated,
} from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Prisma select projecting exactly the UserSummary fields for notification actors. */
const USER_SUMMARY_SELECT = {
  id: true,
  studentId: true,
  name: true,
  avatar: true,
  role: true,
  classId: true,
} as const satisfies Prisma.UserSelect;

/** Prisma include shape for a notification with its actor + podcast title. */
const NOTIFICATION_INCLUDE = {
  actor: { select: USER_SUMMARY_SELECT },
  podcast: { select: { id: true, title: true } },
} satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof NOTIFICATION_INCLUDE;
}>;

/** Map a Prisma notification row (with actor + podcast) to NotificationItem. */
function toNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    content: row.content,
    podcastId: row.podcastId,
    podcastTitle: row.podcast?.title ?? null,
    actor: row.actor
      ? {
          id: row.actor.id,
          studentId: row.actor.studentId,
          name: row.actor.name,
          avatar: row.actor.avatar,
          role: row.actor.role,
          classId: row.actor.classId,
        }
      : null,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Notification domain service.
 *
 * Centralizes creation + retrieval of user notifications. Other services
 * (PodcastService, CommentService, AdminPodcastsService,
 * AdminAnnouncementsService) inject this to fire notifications on lifecycle
 * events. Reads are scoped to the authenticated user.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a single notification. */
  async createForUser(
    userId: number,
    type: NotificationType,
    title: string,
    content: string,
    podcastId?: number,
    actorId?: number,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        podcastId: podcastId ?? null,
        actorId: actorId ?? null,
      },
    });
  }

  /**
   * Fan-out: create a notification for every user in `userIds`. Used for
   * admin broadcasts. Uses createMany for a single round-trip.
   */
  async createForUsers(
    userIds: number[],
    type: NotificationType,
    title: string,
    content: string,
    podcastId?: number,
    actorId?: number,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((uid) => ({
        userId: uid,
        type,
        title,
        content,
        podcastId: podcastId ?? null,
        actorId: actorId ?? null,
      })),
    });
  }

  /**
   * Paginated list of the user's notifications, newest first. Each item
   * carries the actor (UserSummary) and podcast title (when present) for
   * display + deep-linking.
   */
  async list(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Paginated<NotificationItem>> {
    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const safePageSize =
      Number.isFinite(pageSize) && pageSize >= 1
        ? Math.min(100, Math.floor(pageSize))
        : 20;

    const where: Prisma.NotificationWhereInput = { userId };
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        include: NOTIFICATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      items: rows.map(toNotificationItem),
      total,
      hasMore: safePage * safePageSize < total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /** Count of unread notifications for the badge. */
  async unreadCount(userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  /** Mark a single notification as read (scoped to the requesting user). */
  async markAsRead(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('通知不存在');
    }
    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  /** Mark all of the user's unread notifications as read. */
  async markAllRead(userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
