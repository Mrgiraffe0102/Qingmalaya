import { Controller, Get, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Tag HTTP endpoints.
 *
 * - GET /tags     — all tags ordered by weight (upload page tag selector).
 * - GET /tags/hot — top 8 tags by weight (quick-pick row).
 */
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  findAll() {
    return this.tags.findAll();
  }

  @Get('hot')
  findHot() {
    return this.tags.findHot();
  }
}
