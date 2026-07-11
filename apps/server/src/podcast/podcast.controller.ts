import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PodcastService } from './podcast.service';
import { CreatePodcastDto } from './dto/create-podcast.dto';
import { UpdatePodcastDto } from './dto/update-podcast.dto';
import { ListPodcastDto } from './dto/list-podcast.dto';
import { PlayPodcastDto } from './dto/play-podcast.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Podcast HTTP endpoints (all mounted under /api/podcasts).
 *
 * - GET    /podcasts/discovery     — auth required; aggregate discovery feed.
 * - GET    /podcasts               — optional auth; filtered/paginated list.
 * - GET    /podcasts/:id           — auth required; detail with liked/favorited.
 * - POST   /podcasts               — auth required; create (PENDING status).
 * - PUT    /podcasts/:id           — auth + ownership/role; update.
 * - DELETE /podcasts/:id           — auth + ownership/role; delete.
 * - POST   /podcasts/:id/like      — auth required; idempotent like.
 * - DELETE /podcasts/:id/like      — auth required; idempotent unlike.
 * - POST   /podcasts/:id/favorite  — auth required; idempotent favorite.
 * - DELETE /podcasts/:id/favorite  — auth required; idempotent unfavorite.
 * - POST   /podcasts/:id/play      — auth required; track play + resume position.
 *
 * The `discovery` route is declared before `:id` so it isn't shadowed by the
 * dynamic segment.
 */
@Controller('podcasts')
export class PodcastController {
  constructor(private readonly podcast: PodcastService) {}

  @Get('discovery')
  @UseGuards(JwtAuthGuard)
  discovery(@CurrentUser('id') userId: number) {
    return this.podcast.discovery(userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Query() dto: ListPodcastDto,
    @CurrentUser('id') userId: number | undefined,
  ) {
    return this.podcast.list(dto, userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole: string,
  ) {
    return this.podcast.detail(id, userId, userRole);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreatePodcastDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.podcast.create(dto, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePodcastDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole: string,
  ) {
    return this.podcast.update(id, dto, userId, userRole);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole: string,
  ) {
    return this.podcast.remove(id, userId, userRole);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.podcast.like(id, userId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  unlike(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.podcast.unlike(id, userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  favorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.podcast.favorite(id, userId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  unfavorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.podcast.unfavorite(id, userId);
  }

  @Post(':id/play')
  @UseGuards(JwtAuthGuard)
  play(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PlayPodcastDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') userRole: string,
  ) {
    return this.podcast.play(id, userId, dto.position ?? 0, dto.start ?? false, userRole);
  }
}
