import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BannerLinkType, BannerStatus } from '@qingmalaya/shared';

/**
 * Create-banner request body for POST /admin/banners.
 *
 * `title` and `coverPath` are required. `linkType` defaults to NONE,
 * `status` defaults to ONLINE, and `sort` defaults to 0 at the service
 * layer when omitted. `startAt`/`endAt` are optional ISO 8601 timestamps.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe's transform step, not via a
 * constructor).
 */
export class AdminBannerCreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @IsString()
  @MinLength(1)
  coverPath!: string;

  @IsEnum(BannerLinkType)
  @IsOptional()
  linkType?: BannerLinkType;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  linkTarget?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sort?: number;

  @IsEnum(BannerStatus)
  @IsOptional()
  status?: BannerStatus;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;
}
