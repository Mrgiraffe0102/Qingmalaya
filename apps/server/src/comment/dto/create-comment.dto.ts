import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Create-comment request body. Validated by the global ValidationPipe before
 * reaching CommentService.create.
 *
 * `content` is required and bounded to 1..1000 chars. `parentId` is optional
 * and, when present, must reference an existing top-level comment on the same
 * podcast (the service enforces the same-podcast + 2-level rules).
 *
 * The `!` / `?` definite-assignment forms follow the NestJS DTO convention:
 * properties are populated by the ValidationPipe transform step, not via a
 * constructor. `@Type(() => Number)` coerces the string query/json value to a
 * number; `@IsOptional` skips validation for both undefined and null so clients
 * may send `parentId: null` explicitly.
 */
export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number | null;
}
