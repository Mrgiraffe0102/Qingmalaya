import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UploadedFile } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UPLOAD_DIR } from '../upload/upload.helpers';
import { join } from 'path';
import { promises as fsPromises } from 'fs';

/**
 * Admin upload management service.
 *
 * Lists uploaded images from the UploadedFile table (filtered to image/*
 * mimetypes) and deletes them after checking that no Banner, Podcast, or
 * Collection still references the file path.
 */
@Injectable()
export class AdminUploadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 24): Promise<{
    items: UploadedFile[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = { mimetype: { startsWith: 'image/' } };
    const [total, rows] = await Promise.all([
      this.prisma.uploadedFile.count({ where }),
      this.prisma.uploadedFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        originalName: r.originalName,
        path: r.path,
        mimetype: r.mimetype,
        size: r.size,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async remove(id: number): Promise<{ id: number }> {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id },
    });
    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    const [bannerRefs, podcastRefs, collectionRefs] = await Promise.all([
      this.prisma.banner.count({ where: { coverPath: file.path } }),
      this.prisma.podcast.count({ where: { coverPath: file.path } }),
      this.prisma.collection.count({ where: { coverPath: file.path } }),
    ]);
    const refCount = bannerRefs + podcastRefs + collectionRefs;
    if (refCount > 0) {
      throw new BadRequestException(
        `该图片仍被 ${refCount} 个资源引用，无法删除`,
      );
    }

    await fsPromises.unlink(join(UPLOAD_DIR, file.path)).catch(
      () => undefined,
    );
    await this.prisma.uploadedFile.delete({ where: { id } });
    return { id };
  }
}
