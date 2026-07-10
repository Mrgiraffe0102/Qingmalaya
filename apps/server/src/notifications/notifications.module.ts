import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Global notification module.
 *
 * Exposes NotificationsService app-wide so feature services (PodcastService,
 * CommentService, AdminPodcastsService, AdminAnnouncementsService) can inject
 * it without importing this module explicitly. PrismaService is @Global so
 * no explicit import needed here either.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
