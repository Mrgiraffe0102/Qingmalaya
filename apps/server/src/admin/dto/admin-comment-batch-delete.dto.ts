import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-delete request body for POST /admin/comments/batch-delete. `ids` must
 * be a non-empty array of comment IDs. The service deletes each comment (or
 * soft-hides it when it has replies, mirroring the user-facing delete flow),
 * decrements the related podcast.commentCount per comment, and writes a single
 * AdminLog entry. Missing IDs are silently skipped.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminCommentBatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];
}
