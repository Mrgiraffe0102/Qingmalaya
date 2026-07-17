import { Module } from '@nestjs/common';
import { PopupAdminController, PopupPublicController } from './popup.controller';
import { PopupService } from './popup.service';

/**
 * 全局弹窗模块。两个 controller：公开的 `PopupPublicController`（/popup/active，
 * 无 auth）和管理的 `PopupAdminController`（/admin/popup，JwtAuthGuard +
 * RolesGuard 限定 SUPER_ADMIN）。
 *
 * PrismaModule 是 @Global，这里不需要导入。
 */
@Module({
  controllers: [PopupPublicController, PopupAdminController],
  providers: [PopupService],
})
export class PopupModule {}
