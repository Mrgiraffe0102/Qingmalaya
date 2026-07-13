import {
  IsEnum,
  IsArray,
  IsInt,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewAction } from '@qingmalaya/shared';

/**
 * DTO for POST /student-review/:podcastId/review. Student admins submit one
 * of three actions: APPROVE (pass), FLAG (needs teacher review), or REJECT
 * (take down). REJECT accepts reasonTags (indices into COMMON_REJECT_REASONS)
 * and an optional free-text reason; FLAG requires a reason string.
 */
export class StudentReviewActionDto {
  @IsEnum(ReviewAction)
  action!: ReviewAction;

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
