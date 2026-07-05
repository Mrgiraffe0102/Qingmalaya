import { PartialType } from '@nestjs/mapped-types';
import { AdminBannerCreateDto } from './admin-banner-create.dto';

/**
 * Update-banner request body for PUT /admin/banners/:id. All fields of
 * AdminBannerCreateDto are made optional via PartialType, so callers can
 * PATCH any subset. Validation rules (length bounds, enum, integer
 * coercion, ISO date) are inherited from AdminBannerCreateDto.
 */
export class AdminBannerUpdateDto extends PartialType(AdminBannerCreateDto) {}
