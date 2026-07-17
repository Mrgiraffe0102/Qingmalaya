import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTagDto } from './dto/create-tag.dto';

/**
 * Tag HTTP endpoints.
 *
 * - GET /tags     — all tags ordered by weight (upload page tag selector).
 * - GET /tags/hot — top 6 tags by weight (quick-pick row).
 * - POST /tags    — DEPRECATED for client use. The mobile upload page no
 *                   longer calls this endpoint directly: typing a new tag
 *                   only stages the name in local state, and the server
 *                   find-or-creates the tag when the podcast is published
 *                   (see PodcastService.resolveTagIds). This endpoint is
 *                   kept restricted to admin roles as defense-in-depth so
 *                   a stale mobile build, a tampered client, or any other
 *                   caller cannot pollute the global tag list by issuing
 *                   arbitrary POSTs. Use POST /admin/tags for admin
 *                   tag management.
 */
@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
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

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateTagDto) {
    return this.tags.findOrCreate(dto.name);
  }
}
