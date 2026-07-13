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
 * Query-string DTO for GET /admin/users. All fields are optional with
 * sensible defaults applied via class field initializers (effective because
 * the global ValidationPipe runs with `transform: true`, which instantiates
 * `keyword` matches studentId OR name (contains, case-insensitive
 * under MySQL's default collation). `classId` filters by class membership.
 * `classIds` is a comma-separated list for the teacher class-scope dropdown.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminUsersListDto {
  @IsString()
  @MaxLength(64)
  @IsOptional()
  keyword?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  classId?: number;

  @IsString()
  @IsOptional()
  classIds?: string;

  /**
   * Comma-separated list of Role enum values to include (e.g. "STUDENT,TEACHER").
   * Admin accounts (OPERATOR/SUPER_ADMIN) live in /admin/admins and should not
   * surface in the user-management list — the Users page always passes
   * "STUDENT,TEACHER" to enforce this.
   */
  @IsString()
  @IsOptional()
  roles?: string;

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
