import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActivePopupResponse, SitePopup } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PopupUpdateDto } from './dto/popup-update.dto';

/**
 * 把 Prisma Popup row 转成 shared SitePopup（Date → ISO string）。
 */
function toSitePopup(row: {
  id: number;
  title: string;
  content: string;
  enabled: boolean;
  updatedAt: Date;
}): SitePopup {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 全局弹窗服务。`Popup` 表始终只有一条记录（id=1）——管理员通过 `upsert` 整体
 * 替换内容，公开端点只暴露 `enabled=true` 的那条。
 *
 * 设计要点：
 * - 不需要列表、不需要分页；只有"取当前 / 替换当前 / 取公开当前"三个动作。
 * - 单条记录用 id=1 锚定：`upsert` 以 `id: 1` 作为 create 的初始 id，后续
 *   update 走 `where: { id: 1 }`。
 * - 不写 AdminLog：操作频次极低，且是单一全局配置。
 */
@Injectable()
export class PopupService {
  /** 单条记录 id 永远为 1。 */
  private static readonly SINGLETON_ID = 1;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 读取当前唯一一条（任意 enabled 状态）。不存在返回 null。
   * 管理端 GET /admin/popup 用。
   */
  async find(): Promise<SitePopup | null> {
    const row = await this.prisma.popup.findUnique({
      where: { id: PopupService.SINGLETON_ID },
    });
    return row ? toSitePopup(row) : null;
  }

  /**
   * 读取 enabled=true 的当前弹窗。公开端点 GET /popup/active 用。
   * 不存在或被禁用都返回 null。
   */
  async findActive(): Promise<ActivePopupResponse> {
    const row = await this.prisma.popup.findUnique({
      where: { id: PopupService.SINGLETON_ID },
    });
    if (!row || !row.enabled) {
      return { popup: null };
    }
    return { popup: toSitePopup(row) };
  }

  /**
   * Upsert 弹窗：表中无记录时插入一条（id=1），有记录时整体替换 title/content/enabled。
   * 服务端对 `enabled` 缺省值补 true，匹配前端省略该字段时的语义。
   */
  async upsert(dto: PopupUpdateDto): Promise<SitePopup> {
    const row = await this.prisma.popup.upsert({
      where: { id: PopupService.SINGLETON_ID },
      create: {
        id: PopupService.SINGLETON_ID,
        title: dto.title,
        content: dto.content,
        enabled: dto.enabled ?? true,
      },
      update: {
        title: dto.title,
        content: dto.content,
        enabled: dto.enabled ?? true,
      },
    });
    return toSitePopup(row);
  }

  /**
   * 删除当前弹窗（管理端"重置"功能备用，本期不暴露到 UI）。供后续扩展使用。
   */
  async remove(): Promise<{ success: true }> {
    try {
      await this.prisma.popup.delete({
        where: { id: PopupService.SINGLETON_ID },
      });
    } catch (e) {
      // Prisma 在记录不存在时抛 P2025；这里把 404 转成"成功 no-op"
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === 'P2025'
      ) {
        return { success: true };
      }
      throw new NotFoundException('弹窗不存在');
    }
    return { success: true };
  }
}
