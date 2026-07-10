import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Create-banned-keyword request body for POST /admin/banned-keywords.
 *
 * Accepts a `keywords` array so the admin can add multiple words at once
 * (the admin form splits a textarea by newline). Each entry is bounded to
 * 1..50 chars. Duplicates (within the payload or against existing rows) are
 * skipped by the service via `createMany({ skipDuplicates })`.
 *
 * The `!` definite-assignment assertion follows the NestJS DTO convention
 * (populated by ValidationPipe's transform step, not a constructor).
 */
export class AdminBannedKeywordCreateDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  keywords!: string[];
}
