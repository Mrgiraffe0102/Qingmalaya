import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

/**
 * Admin dashboard endpoints (OPERATOR+ only).
 *
 * - GET /admin/dashboard/stats — 5 stat cards, 30-day upload/play trends,
 *   class activity, and top-10 podcasts for the dashboard overview.
 */
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboard.getStats();
  }
}
