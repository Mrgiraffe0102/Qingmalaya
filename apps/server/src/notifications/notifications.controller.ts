import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Notification HTTP endpoints (all mounted under /api/notifications).
 *
 * - GET    /notifications              — paginated list of the user's notifications
 * - GET    /notifications/unread-count — just the unread count (for the badge)
 * - PUT    /notifications/:id/read     — mark single as read
 * - PUT    /notifications/read-all     — mark all as read
 *
 * All routes require authentication (JwtAuthGuard). The `unread-count` route
 * is declared before `:id` so it isn't shadowed by the dynamic segment.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser('id') userId: number = 0,
  ) {
    return this.notifications.list(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: number = 0) {
    return this.notifications.unreadCount(userId).then((count) => ({
      count,
    }));
  }

  @Put('read-all')
  markAllRead(@CurrentUser('id') userId: number = 0) {
    return this.notifications.markAllRead(userId);
  }

  @Put(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number = 0,
  ) {
    return this.notifications.markAsRead(id, userId);
  }
}
