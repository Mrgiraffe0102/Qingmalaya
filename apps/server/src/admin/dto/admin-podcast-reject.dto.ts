import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for PUT /admin/podcasts/:id/reject — rejects a podcast with a reason.
 * `reasonTags` are indices into `COMMON_REJECT_REASONS` (multi-select);
 * `reason` is free-text. Both are combined server-side into a single reason
 * string stored in the PodcastReview record.
 */
export class AdminPodcastRejectDto {
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  reasonTags?: number[];

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
