import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Allowed sort values for the podcast list endpoint. */
const SORT_OPTIONS = ['newest', 'oldest', 'name', 'likes', 'views'] as const;

/**
 * Query-string DTO for GET /podcasts. All fields are optional with sensible
 * defaults applied via class field initializers (effective because the global
 * ValidationPipe runs with `transform: true`, which instantiates the class).
 *
 * The `tag` param accepts either a single value or an array (multi-select)
 * and is normalized to a numeric tag-ID array via @Transform — query params
 * always arrive as strings, so we coerce and drop anything non-numeric.
 */
export class ListPodcastDto {
  @IsString()
  @IsIn([...SORT_OPTIONS])
  @IsOptional()
  sort?: string = 'newest';

  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.map(Number).filter((n) => !Number.isNaN(n));
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  tag?: number[];

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  classId?: number;

  @IsString()
  @IsOptional()
  keyword?: string;

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
