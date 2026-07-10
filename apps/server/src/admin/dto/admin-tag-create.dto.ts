import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TagColor } from '@qingmalaya/shared';

/**
 * Create-tag request body for POST /admin/tags.
 *
 * `name` is required (unique). `weight` defaults to 0 and `color` defaults
 * to a random TagColor at the service layer when omitted. Validation accepts
 * the lowercase TagColor values stored in the DB
 * ('mint' | 'purple' | 'orange' | 'rose' | 'sky' | 'teal' | 'indigo' | 'amber').
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminTagCreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @IsEnum(TagColor)
  @IsOptional()
  color?: TagColor;
}
