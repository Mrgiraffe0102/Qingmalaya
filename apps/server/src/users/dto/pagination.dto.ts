import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared pagination query DTO for list endpoints. With the global
 * ValidationPipe (transform: true) + @Type, query strings are coerced
 * to integers before validation. Defaults are applied in the service
 * layer (page 1, pageSize 20) so callers can omit either param.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
