import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminSuperLogsService } from './admin-super-logs.service';
import { AdminSuperLogsQueryDto } from './dto/admin-super-logs-query.dto';

/**
 * Super log endpoint — SUPER_ADMIN only.
 *
 * Paginated, filterable user activity log list. Tracks every meaningful user
 * action (play, like, favorite, comment, profile update, etc.).
 */
@Controller('admin/super-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSuperLogsController {
  constructor(private readonly superLogs: AdminSuperLogsService) {}

  @Get()
  list(@Query() query: AdminSuperLogsQueryDto) {
    return this.superLogs.findMany(query);
  }
}
