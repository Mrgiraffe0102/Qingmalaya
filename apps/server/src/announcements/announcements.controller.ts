import { Controller, Get } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';

/**
 * Announcement HTTP endpoints.
 *
 * - GET /announcements/latest — public, most recent PUBLISHED announcement (or null).
 *   Made public so the login page can display the latest announcement before
 *   the user is authenticated.
 */
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('latest')
  findLatest() {
    return this.announcements.findLatest();
  }
}
