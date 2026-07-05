import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AnnouncementStatus } from '@qingmalaya/shared';

/**
 * Create-announcement request body for POST /admin/announcements.
 *
 * `title` and `content` are required. `status` defaults to DRAFT at the
 * service layer when omitted; if PUBLISHED is supplied, the service also
 * sets `publishedAt = now`.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminAnnouncementCreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsEnum(AnnouncementStatus)
  @IsOptional()
  status?: AnnouncementStatus;
}
