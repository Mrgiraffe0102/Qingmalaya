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
 * the class). `keyword` matches studentId OR name (contains, case-insensitive
 * under MySQL's default collation). `classId` filters by class membership.
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
