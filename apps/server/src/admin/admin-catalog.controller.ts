import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AdminTagsService,
  AdminBannersService,
  AdminAnnouncementsService,
} from './admin-catalog.service';
import { AdminTagCreateDto } from './dto/admin-tag-create.dto';
import { AdminTagUpdateDto } from './dto/admin-tag-update.dto';
import { AdminBannerCreateDto } from './dto/admin-banner-create.dto';
import { AdminBannerUpdateDto } from './dto/admin-banner-update.dto';
import { AdminBannerSortDto } from './dto/admin-banner-sort.dto';
import { AdminAnnouncementCreateDto } from './dto/admin-announcement-create.dto';
import { AdminAnnouncementUpdateDto } from './dto/admin-announcement-update.dto';

/**
 * Admin tag + banner + announcement management endpoints (Tasks 29 + 30 + 31).
 *
 * All three controllers require OPERATOR or SUPER_ADMIN role (enforced by
 * JwtAuthGuard + RolesGuard). Every mutation is audited via AdminLog inside
 * the corresponding service method.
 */
@Controller('admin/tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminTagsController {
  constructor(private readonly tags: AdminTagsService) {}

  @Get()
  list() {
    return this.tags.list();
  }

  @Post()
  create(
    @Body() dto: AdminTagCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.tags.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminTagUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.tags.update(id, dto, adminId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.tags.remove(id, adminId);
  }
}

@Controller('admin/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminBannersController {
  constructor(private readonly banners: AdminBannersService) {}

  @Get()
  list() {
    return this.banners.list();
  }

  @Post()
  create(
    @Body() dto: AdminBannerCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.banners.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminBannerUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.banners.update(id, dto, adminId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.banners.remove(id, adminId);
  }

  @Put(':id/sort')
  updateSort(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminBannerSortDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.banners.updateSort(id, dto.sort, adminId);
  }
}

@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AdminAnnouncementsService) {}

  @Get()
  list() {
    return this.announcements.list();
  }

  @Post()
  create(
    @Body() dto: AdminAnnouncementCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.announcements.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAnnouncementUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.announcements.update(id, dto, adminId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.announcements.remove(id, adminId);
  }
}
