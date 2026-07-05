import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Update-podcast request body for PUT /admin/podcasts/:id. All fields are
 * optional — operators may PATCH any subset of metadata. When `tagIds` is
 * supplied, the existing PodcastTag rows are replaced atomically
 * (deleteMany + create) within the service. `audioPath` and `duration` are
 * intentionally not editable from the admin console (audio is immutable post-
 * upload).
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminPodcastUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @IsOptional()
  coverPath?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  tagIds?: number[];
}
