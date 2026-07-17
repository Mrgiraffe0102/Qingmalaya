import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Create-podcast request body. Validated by the global ValidationPipe before
 * reaching PodcastService.create.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class CreatePodcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  title!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsString()
  @MinLength(1)
  coverPath!: string;

  @IsString()
  @MinLength(1)
  audioPath!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  duration!: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  tagIds?: number[];

  /**
   * Names of new tags the user wants to introduce with this podcast. Each
   * name is find-or-created on the server during create/update, so the user
   * does not pollute the global tag list by typing names and abandoning the
   * form — only submitted podcasts contribute new tags to the system.
   */
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  newTagNames?: string[];
}
