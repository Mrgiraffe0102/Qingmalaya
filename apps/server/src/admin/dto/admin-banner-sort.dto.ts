import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * Reorder request body for PUT /admin/banners/:id/sort. `sort` is the new
 * sort value; the frontend sends adjacent indices when moving a banner up
 * or down.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminBannerSortDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort!: number;
}
