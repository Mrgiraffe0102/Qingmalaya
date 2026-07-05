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
 * - `page` / `pageSize` are 1-indexed, pageSize clamped to [1, 100].
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminPodcastListDto {
  @IsString()
  @MaxLength(64)
  @IsOptional()
  keyword?: string;

  @IsIn([...STATUS_OPTIONS])
  @IsOptional()
  status?: string;

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
