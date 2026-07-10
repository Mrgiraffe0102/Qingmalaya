import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BannerStatus } from '@qingmalaya/shared';

/**
 * Create-collection request body for POST /admin/collections.
 */
export class AdminCollectionCreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverPath?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  podcastIds!: number[];

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sort?: number;

  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;
}
