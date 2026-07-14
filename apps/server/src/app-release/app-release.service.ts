import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { appConfig } from '../app.config';
import { UPLOAD_DIR } from '../upload/upload.helpers';
import { CreateReleaseDto } from './dto/create-release.dto';

/**
 * App release management service.
 *
 * - create: upload a new release (version + update content + optional APK path)
 * - findAll: list all releases newest-first (admin)
 * - findLatest: return the most recent release (public)
 * - remove: delete a release and its APK file from disk
 */
@Injectable()
export class AppReleaseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReleaseDto) {
    const exists = await this.prisma.appRelease.findFirst({
      where: {
        OR: [{ version: dto.version }, { versionCode: dto.versionCode }],
      },
    });
    if (exists) {
      throw new ConflictException(
        exists.version === dto.version
          ? `版本号 ${dto.version} 已存在`
          : `版本序号 ${dto.versionCode} 已存在`,
      );
    }

    const release = await this.prisma.appRelease.create({
      data: {
        version: dto.version,
        versionCode: dto.versionCode,
        updateContent: dto.updateContent,
        apkPath: dto.apkPath ?? null,
      },
    });
    return this.toResponse(release);
  }

  async findAll() {
    const releases = await this.prisma.appRelease.findMany({
      orderBy: { versionCode: 'desc' },
    });
    return releases.map((r) => this.toResponse(r));
  }

  async findLatest() {
    const release = await this.prisma.appRelease.findFirst({
      orderBy: { versionCode: 'desc' },
    });
    return { latest: release ? this.toResponse(release) : null };
  }

  async remove(id: number) {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException('版本记录不存在');
    }

    // Delete the APK file from disk if it exists.
    if (release.apkPath) {
      const absPath = join(UPLOAD_DIR, release.apkPath);
      await fsPromises.unlink(absPath).catch(() => undefined);
    }

    await this.prisma.appRelease.delete({ where: { id } });
    return { id };
  }

  /**
   * Convert a Prisma AppRelease row to the API response shape, adding the
   * full download URL for the APK (if present).
   */
  private toResponse(r: {
    id: number;
    version: string;
    versionCode: number;
    updateContent: string;
    apkPath: string | null;
    createdAt: Date;
  }) {
    const config = appConfig();
    return {
      id: r.id,
      version: r.version,
      versionCode: r.versionCode,
      updateContent: r.updateContent,
      apkPath: r.apkPath,
      downloadUrl: r.apkPath
        ? `${config.publicBaseUrl}/static/${r.apkPath}`
        : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
