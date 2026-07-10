import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTagDto } from './dto/create-tag.dto';

/**
 * Tag HTTP endpoints.
 *
 * - GET /tags     — all tags ordered by weight (upload page tag selector).
 * - GET /tags/hot — top 6 tags by weight (quick-pick row).
 * - POST /tags    — find-or-create a tag by name (upload page tag input).
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

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateTagDto) {
    return this.tags.findOrCreate(dto.name);
  }
}
