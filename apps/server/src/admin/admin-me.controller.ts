import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';

/**
 * Current-user endpoints (GET /admin/me/*). All routes require authentication
 * (JwtAuthGuard + RolesGuard). TEACHER role is mapped to OPERATOR by
 * RolesGuard, so @Roles('OPERATOR', 'SUPER_ADMIN') admits teachers too.
 *
 * - GET /admin/me/managed-classes — returns the current user's managed
 *   classes. For non-teachers: { manageAllClasses: false, classes: [] }.
 *   For teachers: their assigned classes (or manageAllClasses=true).
 *   Used by the admin frontend to populate the class-scope dropdown.
 */
@Controller('admin/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminMeController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('managed-classes')
  managedClasses(@CurrentUser('id') userId: number) {
    return this.users.getManagedClasses(userId);
  }
}
