import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Create-class request body. `name` is required; `grade` is an optional
 * free-text descriptor.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminCreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  grade?: string;
}

/**
 * Update-class request body — all fields optional. Reuses PartialType so
 * validation decorators from AdminCreateClassDto carry over (each field
 * becomes optional but length constraints still apply when present).
 */
export class AdminUpdateClassDto extends PartialType(AdminCreateClassDto) {}

/**
 * Batch student-import request body. `lines` is a single multi-line string
 * where each non-empty line is `studentId,name` (comma- or tab-separated).
 * Empty lines and surrounding whitespace are trimmed by the service.
 */
export class AdminImportStudentsDto {
  @IsString()
  @MinLength(1)
  lines!: string;
}
