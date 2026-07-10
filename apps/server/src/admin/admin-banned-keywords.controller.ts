import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminBannedKeywordsService } from './admin-banned-keywords.service';
import { AdminBannedKeywordCreateDto } from './dto/admin-banned-keyword-create.dto';

/**
 * Admin banned-keyword management endpoints.
 *
 * Guarded by JwtAuthGuard + RolesGuard, restricted to OPERATOR / SUPER_ADMIN.
 * Keywords are checked against comment content in CommentService.createComment.
 *
 *   GET    /              — list all banned keywords
 *   POST   /              — batch-create keywords (duplicates skipped)
 *   DELETE /:id           — delete a single keyword
 *
 * Every mutation writes an AdminLog row (see AdminBannedKeywordsService).
 */
@Controller('admin/banned-keywords')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminBannedKeywordsController {
  constructor(private readonly keywords: AdminBannedKeywordsService) {}

  /** GET /admin/banned-keywords — list all banned keywords, newest first. */
  @Get()
  list() {
    return this.keywords.list();
  }

  /** POST /admin/banned-keywords — batch-create keywords. */
  @Post()
  create(
    @Body() dto: AdminBannedKeywordCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.keywords.create(dto, adminId);
  }

  /** DELETE /admin/banned-keywords/:id — delete a single keyword. */
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.keywords.remove(id, adminId);
  }
}
