import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-tag request body for POST /admin/podcasts/batch-tag. Adds the given
 * `tagIds` to every podcast in `ids` (merge semantics — existing tags are
 * preserved, duplicates are skipped via PodcastTag's composite PK). Both
 * arrays must be non-empty. A single AdminLog entry is written.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminPodcastBatchTagDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  tagIds!: number[];
}
