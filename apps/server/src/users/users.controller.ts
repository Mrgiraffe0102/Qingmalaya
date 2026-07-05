import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** Defaults applied when the client omits pagination query params. */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

/**
 * User HTTP endpoints (all authenticated, scoped to the current user).
 *
 * - GET  /users/me           — current user's profile.
 * - PUT  /users/me           — update profile (name/avatar/bio).
 * - GET  /users/me/history   — paginated play history with podcast details.
 * - GET  /users/me/favorites — paginated favorited podcasts.
 * - GET  /users/me/podcasts  — all podcasts authored by the current user
 *                              (any status, newest first) for the 创作 page.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: number) {
    return this.users.getMe(userId);
  }

  @Put('me')
  updateMe(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.updateMe(userId, dto);
  }

  @Get('me/history')
  getHistory(
    @CurrentUser('id') userId: number,
    @Query() query: PaginationDto,
  ) {
    return this.users.getHistory(
      userId,
      query.page ?? DEFAULT_PAGE,
      query.pageSize ?? DEFAULT_PAGE_SIZE,
    );
  }

  @Get('me/favorites')
  getFavorites(
    @CurrentUser('id') userId: number,
    @Query() query: PaginationDto,
  ) {
    return this.users.getFavorites(
      userId,
      query.page ?? DEFAULT_PAGE,
      query.pageSize ?? DEFAULT_PAGE_SIZE,
    );
  }

  @Get('me/podcasts')
  getMyPodcasts(@CurrentUser('id') userId: number) {
    return this.users.getMyPodcasts(userId);
  }
}
