import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AdminClassesService, AdminUsersService } from './admin-users.service';
import { AdminUsersListDto } from './dto/admin-users-list.dto';
import {
  AdminCreateClassDto,
  AdminImportStudentsDto,
  AdminUpdateClassDto,
} from './dto/admin-classes.dto';

/**
 * Admin user management endpoints (Task 26). All routes require
 * OPERATOR or SUPER_ADMIN role (enforced at the class level by RolesGuard).
 *
 * - GET    /admin/users                   — paginated list (search, classId filter)
 * - PUT    /admin/users/:id/ban           — set status BANNED
 * - PUT    /admin/users/:id/unban         — set status ACTIVE
 * - POST   /admin/users/:id/reset-password — reset to studentId-derived password
 *
 * Each mutation is audited via AdminLog inside the service.
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUsersListDto) {
    return this.users.list({
      keyword: query.keyword,
      classId: query.classId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Put(':id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ban(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ): Promise<void> {
    await this.users.ban(id, adminId);
  }

  @Put(':id/unban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unban(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ): Promise<void> {
    await this.users.unban(id, adminId);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.users.resetPassword(id, adminId);
  }
}

/**
 * Admin class management endpoints (Task 26). All routes require
 * OPERATOR or SUPER_ADMIN role.
 *
 * - GET    /admin/classes           — list all classes with user/podcast counts
 * - POST   /admin/classes           — create class
 * - PUT    /admin/classes/:id       — update class
 * - DELETE /admin/classes/:id       — delete class (rejected if it has users)
 * - POST   /admin/classes/:id/import — batch import students from pasted lines
 */
@Controller('admin/classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminClassesController {
  constructor(private readonly classes: AdminClassesService) {}

  @Get()
  list() {
    return this.classes.list();
  }

  @Post()
  create(
    @Body() dto: AdminCreateClassDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.classes.create(dto, adminId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateClassDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.classes.update(id, dto, adminId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ): Promise<void> {
    await this.classes.remove(id, adminId);
  }

  @Post(':id/import')
  importStudents(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminImportStudentsDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.classes.importStudents(id, dto, adminId);
  }
}
