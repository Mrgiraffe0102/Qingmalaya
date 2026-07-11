import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Query string for GET /admin/super-logs — paginated, filterable user
 * activity log list.
 *
 * - userId:     exact match on the acting user's id.
 * - action:     exact match on the UserAction enum (PLAY, LIKE_PODCAST, …).
 * - targetType:  exact match on the target entity type (Podcast, Comment, User).
 * - startDate / endDate: ISO date strings; both bounds are inclusive and
 *   applied against UserActivityLog.createdAt.
 * - page / pageSize: 1-indexed pagination (pageSize clamped to >=1).
 */
export class AdminSuperLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
