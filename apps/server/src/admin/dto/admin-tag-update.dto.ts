import { PartialType } from '@nestjs/mapped-types';
import { AdminTagCreateDto } from './admin-tag-create.dto';

/**
 * Update-tag request body for PUT /admin/tags/:id. All fields of
 * AdminTagCreateDto are made optional via PartialType, so callers can
 * PATCH any subset. Validation rules (length bounds, enum, integer
 * coercion) are inherited from AdminTagCreateDto.
 */
export class AdminTagUpdateDto extends PartialType(AdminTagCreateDto) {}
