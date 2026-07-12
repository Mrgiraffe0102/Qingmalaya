import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-delete request body for POST /admin/users/batch-delete. `ids` must be
 * a non-empty array of user IDs. The service deletes each user's comments,
 * podcasts, and AdminLog entries, then the user itself. Only STUDENT and
 * TEACHER accounts can be deleted (SUPER_ADMIN is protected). Missing IDs are
 * silently skipped. A single AdminLog entry is written.
 */
export class AdminUserBatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];
}
