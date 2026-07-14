import { Module } from '@nestjs/common';
import { AppReleaseController } from './app-release.controller';
import { AppReleaseService } from './app-release.service';

/**
 * App release module — provides APK version management.
 *
 * Admin endpoints (SUPER_ADMIN) handle release CRUD + APK uploads.
 * The public /releases/latest endpoint is used by mobile/web clients to
 * check for updates.
 *
 * PrismaModule is @Global so no explicit import is needed.
 */
@Module({
  controllers: [AppReleaseController],
  providers: [AppReleaseService],
})
export class AppReleaseModule {}
