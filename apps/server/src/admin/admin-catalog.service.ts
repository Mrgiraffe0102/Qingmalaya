import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Announcement, Banner, Tag } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminTagCreateDto } from './dto/admin-tag-create.dto';
import { AdminTagUpdateDto } from './dto/admin-tag-update.dto';
import { AdminBannerCreateDto } from './dto/admin-banner-create.dto';
import { AdminBannerUpdateDto } from './dto/admin-banner-update.dto';
import { AdminAnnouncementCreateDto } from './dto/admin-announcement-create.dto';
import { AdminAnnouncementUpdateDto } from './dto/admin-announcement-update.dto';

/** Tag row plus the count of PodcastTag references (for the admin table). */
export interface TagWithCount extends Tag {
  podcastCount: number;
}

/** Prisma row shape returned by the tag list query (scalar fields + _count). */
type TagListRow = Prisma.TagGetPayload<{
  select: {
    id: true;
    name: true;
    weight: true;
    color: true;
    createdAt: true;
    _count: { select: { podcasts: true } };
  };
}>;

/** Map a Prisma Tag row (with _count) to the shared Tag + podcastCount shape. */
function toTagWithCount(row: TagListRow): TagWithCount {
  return {
    id: row.id,
    name: row.name,
    weight: row.weight,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    podcastCount: row._count.podcasts,
  };
}

/** Map a Prisma Banner row to the shared Banner shape (dates → ISO strings). */
function toBanner(row: Prisma.BannerGetPayload<{}>): Banner {
  return {
    id: row.id,
    title: row.title,
    coverPath: row.coverPath,
    linkType: row.linkType,
    linkTarget: row.linkTarget,
    markdownContent: row.markdownContent,
    sort: row.sort,
    status: row.status,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Map a Prisma Announcement row to the shared Announcement shape. */
function toAnnouncement(row: Prisma.AnnouncementGetPayload<{}>): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Admin tag management service (Task 29).
 *
 * CRUD over the Tag model with weight-desc ordering. Delete is guarded
 * against tags still referenced by PodcastTag rows. Every mutation writes
 * an AdminLog entry for audit.
 */
@Injectable()
export class AdminTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TagWithCount[]> {
    const rows = await this.prisma.tag.findMany({
      orderBy: { weight: 'desc' },
      select: {
        id: true,
        name: true,
        weight: true,
        color: true,
        createdAt: true,
        _count: { select: { podcasts: true } },
      },
    });
    return rows.map(toTagWithCount);
  }

  async create(dto: AdminTagCreateDto, adminId: number): Promise<Tag> {
    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name,
        weight: dto.weight ?? 0,
        color: dto.color ?? 'mint',
      },
    });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_tag',
        targetType: 'Tag',
        targetId: tag.id,
        detail: { name: tag.name, weight: tag.weight, color: tag.color },
      },
    });
    return {
      id: tag.id,
      name: tag.name,
      weight: tag.weight,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }

  async update(
    id: number,
    dto: AdminTagUpdateDto,
    adminId: number,
  ): Promise<Tag> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('标签不存在');
    }
    const data: Prisma.TagUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.color !== undefined) data.color = dto.color;
    const tag = await this.prisma.tag.update({ where: { id }, data });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_tag',
        targetType: 'Tag',
        targetId: tag.id,
        detail: { fields: Object.keys(dto) },
      },
    });
    return {
      id: tag.id,
      name: tag.name,
      weight: tag.weight,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }

  async remove(id: number, adminId: number): Promise<{ id: number }> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('标签不存在');
    }
    const refCount = await this.prisma.podcastTag.count({
      where: { tagId: id },
    });
    if (refCount > 0) {
      throw new BadRequestException(
        `该标签仍被 ${refCount} 个播客引用，无法删除`,
      );
    }
    await this.prisma.tag.delete({ where: { id } });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_tag',
        targetType: 'Tag',
        targetId: id,
        detail: { name: existing.name },
      },
    });
    return { id };
  }
}

/**
 * Admin banner management service (Task 30).
 *
 * CRUD over the Banner model with sort-asc ordering. Supports an explicit
 * sort-update endpoint for the up/down reorder buttons. Optional startAt/
 * endAt are converted from ISO strings to Date objects before writing.
 */
@Injectable()
export class AdminBannersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Banner[]> {
    const rows = await this.prisma.banner.findMany({
      orderBy: { sort: 'asc' },
    });
    return rows.map(toBanner);
  }

  async create(dto: AdminBannerCreateDto, adminId: number): Promise<Banner> {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        coverPath: dto.coverPath,
        linkType: dto.linkType ?? 'NONE',
        linkTarget: dto.linkTarget ?? null,
        markdownContent: dto.markdownContent ?? null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 'ONLINE',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_banner',
        targetType: 'Banner',
        targetId: banner.id,
        detail: { title: banner.title, sort: banner.sort },
      },
    });
    return toBanner(banner);
  }

  async update(
    id: number,
    dto: AdminBannerUpdateDto,
    adminId: number,
  ): Promise<Banner> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner不存在');
    }
    const data: Prisma.BannerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.coverPath !== undefined) data.coverPath = dto.coverPath;
    if (dto.linkType !== undefined) data.linkType = dto.linkType;
    if (dto.linkTarget !== undefined) {
      data.linkTarget = dto.linkTarget === '' ? null : dto.linkTarget;
    }
    if (dto.markdownContent !== undefined) {
      data.markdownContent = dto.markdownContent === '' ? null : dto.markdownContent;
    }
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startAt !== undefined) {
      data.startAt = dto.startAt ? new Date(dto.startAt) : null;
    }
    if (dto.endAt !== undefined) {
      data.endAt = dto.endAt ? new Date(dto.endAt) : null;
    }
    const banner = await this.prisma.banner.update({ where: { id }, data });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_banner',
        targetType: 'Banner',
        targetId: banner.id,
        detail: { fields: Object.keys(dto) },
      },
    });
    return toBanner(banner);
  }

  async updateSort(
    id: number,
    sort: number,
    adminId: number,
  ): Promise<Banner> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner不存在');
    }
    const banner = await this.prisma.banner.update({
      where: { id },
      data: { sort },
    });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_banner_sort',
        targetType: 'Banner',
        targetId: id,
        detail: { from: existing.sort, to: sort },
      },
    });
    return toBanner(banner);
  }

  async remove(id: number, adminId: number): Promise<{ id: number }> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banner不存在');
    }
    await this.prisma.banner.delete({ where: { id } });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_banner',
        targetType: 'Banner',
        targetId: id,
        detail: { title: existing.title },
      },
    });
    return { id };
  }
}

/**
 * Admin announcement management service (Task 31).
 *
 * CRUD over the Announcement model with newest-first ordering. The publish
 * transition (status → PUBLISHED) stamps `publishedAt = now` if it hasn't
 * been set already, so the first publication time is preserved across
 * subsequent edits.
 */
@Injectable()
export class AdminAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(): Promise<Announcement[]> {
    const rows = await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAnnouncement);
  }

  async create(
    dto: AdminAnnouncementCreateDto,
    adminId: number,
  ): Promise<Announcement> {
    const status = dto.status ?? 'DRAFT';
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_announcement',
        targetType: 'Announcement',
        targetId: announcement.id,
        detail: { title: announcement.title, status: announcement.status },
      },
    });

    if (status === 'PUBLISHED') {
      await this.fanOutBroadcast(announcement.title, announcement.content);
    }

    return toAnnouncement(announcement);
  }

  async update(
    id: number,
    dto: AdminAnnouncementUpdateDto,
    adminId: number,
  ): Promise<Announcement> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('公告不存在');
    }
    const data: Prisma.AnnouncementUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.status !== undefined) {
      data.status = dto.status;
      // Stamp publishedAt on the first PUBLISHED transition.
      if (dto.status === 'PUBLISHED' && existing.publishedAt === null) {
        data.publishedAt = new Date();
      }
    }
    const announcement = await this.prisma.announcement.update({
      where: { id },
      data,
    });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_announcement',
        targetType: 'Announcement',
        targetId: announcement.id,
        detail: { fields: Object.keys(dto) },
      },
    });

    // Fan-out only on first publish transition.
    if (
      dto.status === 'PUBLISHED' &&
      existing.publishedAt === null &&
      announcement.publishedAt !== null
    ) {
      await this.fanOutBroadcast(announcement.title, announcement.content);
    }

    return toAnnouncement(announcement);
  }

  /**
   * Fan-out a BROADCAST notification to every active user. Called when an
   * announcement is first published.
   */
  private async fanOutBroadcast(title: string, content: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.createForUsers(
      users.map((u) => u.id),
      'BROADCAST',
      title,
      content,
    );
  }

  async remove(id: number, adminId: number): Promise<{ id: number }> {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('公告不存在');
    }
    await this.prisma.announcement.delete({ where: { id } });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_announcement',
        targetType: 'Announcement',
        targetId: id,
        detail: { title: existing.title },
      },
    });
    return { id };
  }
}
