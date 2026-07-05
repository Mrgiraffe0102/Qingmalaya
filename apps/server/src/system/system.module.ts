import { Global, Module } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';

/**
 * Global system module.
 *
 * Exposes SystemSettingService app-wide so the upload module (and any future
 * admin settings module) can read/write runtime configuration without
 * importing this module explicitly.
 */
@Global()
@Module({
  providers: [SystemSettingService],
  exports: [SystemSettingService],
})
export class SystemModule {}
