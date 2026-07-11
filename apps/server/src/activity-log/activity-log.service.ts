import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Parameters for a single activity log entry. `action` is the only required
 * field besides `userId`; the rest describe the target entity and optional
 * detail payload for display in the admin super-log view.
 */
export interface ActivityLogEntry {
  userId: number;
  action: UserAction;
  targetType?: string;
  targetId?: number;
  detail?: Prisma.InputJsonValue;
}

/**
 * Global activity logging service.
 *
 * Centralizes creation of UserActivityLog rows for every meaningful user
 * action (play, like, favorite, comment, profile update, etc.). Injected
 * into PodcastService, CommentService, and UsersService — mirroring how
 * NotificationsService is consumed across the app.
 *
 * The `log()` method is fire-and-forget: callers use `void this.log(...)`
 * so logging failures never interrupt the user's primary action.
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: ActivityLogEntry): Promise<void> {
    try {
      await this.prisma.userActivityLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          detail: entry.detail,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write activity log: ${(e as Error).message}`,
      );
    }
  }
}
