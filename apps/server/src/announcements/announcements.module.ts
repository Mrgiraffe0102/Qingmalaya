import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
// PrismaModule is @Global, no need to import here.

/**
 * Announcements feature module. Read-only platform announcements.
 */
@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
