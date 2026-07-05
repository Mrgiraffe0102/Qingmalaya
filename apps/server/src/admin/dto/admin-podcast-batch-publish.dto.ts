import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-publish request body for POST /admin/podcasts/batch-publish.
 * `ids` must be a non-empty array of podcast IDs; the service sets status to
 * PUBLISHED for every matching podcast (missing IDs are silently skipped),
 * stamping publishedAt on first publish only, and writes a single AdminLog.
 */
export class AdminPodcastBatchPublishDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];
}
