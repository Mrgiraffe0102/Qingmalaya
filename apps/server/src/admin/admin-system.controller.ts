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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AdminAdminsService,
  AdminSettingsService,
  AdminLogsService,
} from './admin-system.service';
import { AdminAdminCreateDto } from './dto/admin-admin-create.dto';
import { AdminAdminUpdateDto } from './dto/admin-admin-update.dto';
import { AdminSettingsUpdateDto } from './dto/admin-settings-update.dto';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';

/**
 * Admin account + system settings + admin log endpoints (Tasks 32 + 33).
 *
 * Three controllers live in this file, all guarded by JwtAuthGuard +
 * RolesGuard:
 *   - AdminAdminsController  — SUPER_ADMIN only. CRUD for admin accounts.
 *   - AdminSettingsController — OPERATOR+. Read/upsert SystemSetting rows.
 *   - AdminLogsController     — OPERATOR+. Paginated audit log list.
 */
@Controller('admin/admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminAdminsController {
  constructor(private readonly admins: AdminAdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(
    @Body() dto: AdminAdminCreateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.admins.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAdminUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.admins.update(id, dto, adminId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.admins.remove(id, adminId);
  }
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  findAll() {
    return this.settings.findAll();
  }

  @Put()
  update(
    @Body() body: AdminSettingsUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.settings.update(body, adminId);
  }
}

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminLogsController {
  constructor(private readonly logs: AdminLogsService) {}

  @Get()
  list(@Query() query: AdminLogsQueryDto) {
    return this.logs.findMany(query);
  }
}
