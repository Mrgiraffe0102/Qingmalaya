import { PartialType } from '@nestjs/mapped-types';
import { CreatePodcastDto } from './create-podcast.dto';

/**
 * Update-podcast request body. All fields of CreatePodcastDto are made
 * optional via PartialType, so callers can PATCH any subset. Validation
 * rules (length bounds, integer coercion) are inherited from
 * CreatePodcastDto.
 */
export class UpdatePodcastDto extends PartialType(CreatePodcastDto) {}
