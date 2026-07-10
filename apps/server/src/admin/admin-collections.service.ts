import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Collection } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCollectionCreateDto } from './dto/admin-collection-create.dto';
import { AdminCollectionUpdateDto } from './dto/admin-collection-update.dto';

/** Collection list item with podcast count. */
export interface CollectionWithCount extends Collection {
  podcastCount: number;
}

type CollectionListRow = {
  id: number;
  title: string;
  description: string | null;
  coverPath: string | null;
  sort: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { podcasts: number };
};

function toCollectionWithCount(row: CollectionListRow): CollectionWithCount {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverPath: row.coverPath,
    sort: row.sort,
    status: row.status as Collection['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    podcastCount: row._count.podcasts,
  };
}

/**
 * Admin Collection management service.
 *
 * CRUD over the Collection model. Podcast associations are replaced
 * atomically (deleteMany + createMany) when podcastIds is supplied.
 */
@Injectable()
export class AdminCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(
    id: number,
  ): Promise<CollectionWithCount & { podcastIds: number[] }> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        podcasts: { select: { podcastId: true, sort: true } },
        _count: { select: { podcasts: true } },
      },
    });
    if (!collection) {
      throw new NotFoundException('精选集不存在');
    }
    return {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      coverPath: collection.coverPath,
      sort: collection.sort,
      status: collection.status as Collection['status'],
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      podcastCount: collection._count.podcasts,
      podcastIds: collection.podcasts
        .sort((a, b) => a.sort - b.sort)
        .map((cp) => cp.podcastId),
    };
  }

  async list(): Promise<CollectionWithCount[]> {
    const rows = await this.prisma.collection.findMany({
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        coverPath: true,
        sort: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { podcasts: true } },
      },
    });
    return rows.map(toCollectionWithCount);
  }

  async create(
    dto: AdminCollectionCreateDto,
    adminId: number,
  ): Promise<CollectionWithCount> {
    const podcasts = await this.prisma.podcast.findMany({
      where: { id: { in: dto.podcastIds } },
      select: { id: true },
    });
    if (podcasts.length === 0) {
      throw new BadRequestException('请选择至少一个有效的播客');
    }

    const collection = await this.prisma.collection.create({
      data: {
        title: dto.title,
        description: dto.description,
        coverPath: dto.coverPath,
        sort: dto.sort ?? 0,
        status: dto.status ?? 'ONLINE',
        podcasts: {
          create: podcasts.map((p, idx) => ({
            podcastId: p.id,
            sort: idx,
          })),
        },
      },
      include: { _count: { select: { podcasts: true } } },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_collection',
        targetType: 'Collection',
        targetId: collection.id,
        detail: {
          title: collection.title,
          podcastIds: dto.podcastIds,
        },
      },
    });

    return toCollectionWithCount(collection);
  }

  async update(
    id: number,
    dto: AdminCollectionUpdateDto,
    adminId: number,
  ): Promise<CollectionWithCount> {
    const existing = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('精选集不存在');
    }

    const data: Prisma.CollectionUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverPath !== undefined) data.coverPath = dto.coverPath;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.podcastIds !== undefined) {
      const podcasts = await this.prisma.podcast.findMany({
        where: { id: { in: dto.podcastIds } },
        select: { id: true },
      });
      if (podcasts.length === 0) {
        throw new BadRequestException('请选择至少一个有效的播客');
      }
      data.podcasts = {
        deleteMany: {},
        create: podcasts.map((p, idx) => ({
          podcastId: p.id,
          sort: idx,
        })),
      };
    }

    const collection = await this.prisma.collection.update({
      where: { id },
      data,
      include: { _count: { select: { podcasts: true } } },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_collection',
        targetType: 'Collection',
        targetId: collection.id,
        detail: { fields: Object.keys(dto) },
      },
    });

    return toCollectionWithCount(collection);
  }

  async remove(id: number, adminId: number): Promise<{ id: number }> {
    const existing = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('精选集不存在');
    }
    await this.prisma.collection.delete({ where: { id } });
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_collection',
        targetType: 'Collection',
        targetId: id,
        detail: { title: existing.title },
      },
    });
    return { id };
  }
}
