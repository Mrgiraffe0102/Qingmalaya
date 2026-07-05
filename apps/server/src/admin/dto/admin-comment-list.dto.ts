import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query-string DTO for GET /admin/comments. All fields are optional with
 * sensible defaults applied via class field initializers (effective because
 * the global ValidationPipe runs with `transform: true`, which instantiates
 * the class).
 *
 * - `podcastId` filters by the commented podcast.
 * - `userId` filters by the comment author.
 * - `keyword` matches Comment.content (contains, case-insensitive).
 * - `startDate` / `endDate` are ISO date strings (YYYY-MM-DD or full ISO);
 *   both bounds are inclusive and applied against Comment.createdAt.
 * - `page` / `pageSize` are 1-indexed, pageSize clamped to [1, 100].
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminCommentListDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  podcastId?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

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
