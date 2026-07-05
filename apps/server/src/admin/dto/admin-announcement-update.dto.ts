import { PartialType } from '@nestjs/mapped-types';
import { AdminAnnouncementCreateDto } from './admin-announcement-create.dto';

/**
 * Update-announcement request body for PUT /admin/announcements/:id. All
 * fields of AdminAnnouncementCreateDto are made optional via PartialType,
 * so callers can PATCH any subset. If `status` is changed to PUBLISHED and
 * `publishedAt` is still null, the service stamps `publishedAt = now`.
 * Validation rules are inherited from AdminAnnouncementCreateDto.
 */
export class AdminAnnouncementUpdateDto extends PartialType(
  AdminAnnouncementCreateDto,
) {}
