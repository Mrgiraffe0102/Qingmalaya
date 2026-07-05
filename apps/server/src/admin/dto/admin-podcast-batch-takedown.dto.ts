import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-takedown request body for POST /admin/podcasts/batch-takedown.
 * `ids` must be a non-empty array of podcast IDs; the service sets status to
 * TAKEN_DOWN for every matching podcast (missing IDs are silently skipped)
 * and writes a single AdminLog entry.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminPodcastBatchTakedownDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];
}
