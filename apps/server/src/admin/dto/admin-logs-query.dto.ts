import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Query string for GET /admin/logs — paginated, filterable audit log list.
 *
 * - adminId: exact match on the acting admin's user id.
 * - action:  substring (case-insensitive) keyword match.
 * - startDate / endDate: ISO date strings; both bounds are inclusive and
 *   applied against AdminLog.createdAt.
 * - page / pageSize: 1-indexed pagination (pageSize clamped to >=1).
 */
export class AdminLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adminId?: number;

  @IsOptional()
  @IsString()
  action?: string;

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
