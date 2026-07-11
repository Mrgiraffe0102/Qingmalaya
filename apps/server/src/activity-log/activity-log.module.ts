import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

/**
 * Global activity log module.
 *
 * Exposes ActivityLogService app-wide so feature services (PodcastService,
 * CommentService, UsersService) can inject it without importing this module
 * explicitly. PrismaService is @Global so no explicit import needed here.
 */
@Global()
@Module({
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
