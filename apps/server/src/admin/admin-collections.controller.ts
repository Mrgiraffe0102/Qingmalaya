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
import { AdminCollectionsService } from './admin-collections.service';
import { AdminCollectionCreateDto } from './dto/admin-collection-create.dto';
import { AdminCollectionUpdateDto } from './dto/admin-collection-update.dto';

/**
 * Admin collection management endpoints.
 *
 *   GET    /admin/collections          — list all collections
 *   POST   /admin/collections          — create collection
 *   PUT    /admin/collections/:id      — update collection
 *   DELETE /admin/collections/:id      — delete collection
 */
@Controller('admin/collections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminCollectionsController {
  constructor(private readonly collections: AdminCollectionsService) {}

  @Get()
  list() {
    return this.collections.list();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.collections.detail(id);
  }

  @Post()
  create(
    @Body() dto: AdminCollectionCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.collections.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminCollectionUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.collections.update(id, dto, adminId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.collections.remove(id, adminId);
  }
}
