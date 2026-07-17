import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { ActivePopupResponse, SitePopup } from '@qingmalaya/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PopupService } from './popup.service';
import { PopupUpdateDto } from './dto/popup-update.dto';

/**
 * 公开端点：无 auth 装饰——任何人打开网站（包括登录页）都应该能拉到当前弹窗。
 *
 * `GET /popup/active` — 返回 enabled=true 的当前弹窗；不存在/禁用返 { popup: null }。
 */
@Controller('popup')
export class PopupPublicController {
  constructor(private readonly popup: PopupService) {}

  @Get('active')
  findActive(): Promise<ActivePopupResponse> {
    return this.popup.findActive();
  }
}

/**
 * 管理端点：JwtAuthGuard + RolesGuard，限定 SUPER_ADMIN。
 *
 * - GET    /admin/popup       — 读取当前唯一一条（任意 enabled 状态）
 * - PUT    /admin/popup       — upsert 整体替换
 * - DELETE /admin/popup       — 移除（备用，本期 UI 不暴露）
 */
@Controller('admin/popup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PopupAdminController {
  constructor(private readonly popup: PopupService) {}

  @Get()
  find(): Promise<SitePopup | null> {
    return this.popup.find();
  }

  @Put()
  upsert(@Body() dto: PopupUpdateDto): Promise<SitePopup> {
    return this.popup.upsert(dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(): Promise<void> {
    await this.popup.remove();
  }
}
