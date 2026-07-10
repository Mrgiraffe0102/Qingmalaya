import { PartialType } from '@nestjs/mapped-types';
import { AdminCollectionCreateDto } from './admin-collection-create.dto';

/**
 * Update-collection request body for PUT /admin/collections/:id.
 * All fields made optional via PartialType. podcastIds replaces the entire
 * podcast list when provided.
 */
export class AdminCollectionUpdateDto extends PartialType(
  AdminCollectionCreateDto,
) {}
