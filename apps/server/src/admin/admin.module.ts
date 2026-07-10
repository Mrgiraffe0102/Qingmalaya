import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminUsersController, AdminClassesController } from './admin-users.controller';
import { AdminUsersService, AdminClassesService } from './admin-users.service';
import {
  AdminPodcastsController,
  AdminCommentsController,
} from './admin-content.controller';
import { AdminPodcastsService, AdminCommentsService } from './admin-content.service';
import {
  AdminTagsController,
  AdminBannersController,
  AdminAnnouncementsController,
} from './admin-catalog.controller';
import {
  AdminTagsService,
  AdminBannersService,
  AdminAnnouncementsService,
} from './admin-catalog.service';
import {
  AdminAdminsController,
  AdminSettingsController,
  AdminLogsController,
} from './admin-system.controller';
import {
  AdminAdminsService,
  AdminSettingsService,
  AdminLogsService,
} from './admin-system.service';
import { AdminUploadsController } from './admin-uploads.controller';
import { AdminUploadsService } from './admin-uploads.service';
import { AdminCollectionsController } from './admin-collections.controller';
import { AdminCollectionsService } from './admin-collections.service';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Admin module — aggregates all /admin/* controllers.
 *
 * JwtModule is registered here (with the same secret/TTL as AuthModule) so
 * AdminAuthService can sign tokens without depending on AuthModule's internal
 * JwtModule registration. PrismaService is @Global so no explicit import needed.
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL'),
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminClassesController,
    AdminPodcastsController,
    AdminCommentsController,
    AdminTagsController,
    AdminBannersController,
    AdminAnnouncementsController,
    AdminAdminsController,
    AdminSettingsController,
    AdminLogsController,
    AdminUploadsController,
    AdminCollectionsController,
  ],
  providers: [
    AdminAuthService,
    AdminDashboardService,
    AdminUsersService,
    AdminClassesService,
    AdminPodcastsService,
    AdminCommentsService,
    AdminTagsService,
    AdminBannersService,
    AdminAnnouncementsService,
    AdminAdminsService,
    AdminSettingsService,
    AdminLogsService,
    AdminUploadsService,
    AdminCollectionsService,
    // RolesGuard depends only on Reflector (globally available from @nestjs/core).
    // Registered here so @UseGuards(JwtAuthGuard, RolesGuard) can resolve it
    // without importing AuthModule. JwtStrategy registers globally with passport
    // when AuthModule is instantiated, so JwtAuthGuard works across modules.
    RolesGuard,
  ],
})
export class AdminModule {}
