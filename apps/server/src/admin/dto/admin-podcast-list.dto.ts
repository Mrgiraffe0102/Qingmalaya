import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Allowed status filter values for the admin podcast list endpoint. */
const STATUS_OPTIONS = ['PENDING', 'PUBLISHED', 'TAKEN_DOWN'] as const;

/**
 * Query-string DTO for GET /admin/podcasts. All fields are optional with
 * sensible defaults applied via class field initializers (effective because
 * the global ValidationPipe runs with `transform: true`, which instantiates
 * the class).
 *
 * - `keyword` matches Podcast.title (contains, case-insensitive under MySQL's
 *   default collation).
 * - `status` filters by the PodcastStatus enum (PENDING/PUBLISHED/TAKEN_DOWN).
 * - `classIds` is a comma-separated list of class IDs (e.g. "1,2,3") used by
 *   the teacher class-scope dropdown to filter podcasts by class.
 * - `page` / `pageSize` are 1-indexed, pageSize clamped to [1, 100].
 */
export class AdminPodcastListDto {
  @IsString()
  @MaxLength(64)
  @IsOptional()
  keyword?: string;

  @IsIn([...STATUS_OPTIONS])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  classIds?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}

/** Parse a comma-separated classIds string ("1,2,3") into number[] | undefined. */
export function parseClassIds(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}
