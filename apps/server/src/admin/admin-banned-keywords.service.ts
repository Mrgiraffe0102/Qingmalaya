import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminBannedKeywordCreateDto } from './dto/admin-banned-keyword-create.dto';

/** Prisma row shape for a BannedKeyword list query. */
type BannedKeywordRow = Prisma.BannedKeywordGetPayload<{}>;

/** Map a Prisma BannedKeyword row to the API response shape. */
function toBannedKeyword(row: BannedKeywordRow) {
  return {
    id: row.id,
    keyword: row.keyword,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Admin banned-keyword management service.
 *
 * CRUD over the BannedKeyword model. Keywords are matched case-insensitively
 * against comment content in CommentService.createComment. Every mutation
 * writes an AdminLog entry for audit.
 */
@Injectable()
export class AdminBannedKeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all banned keywords, newest first (GET /admin/banned-keywords). */
  async list() {
    const rows = await this.prisma.bannedKeyword.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBannedKeyword);
  }

  /**
   * Batch-create banned keywords (POST /admin/banned-keywords). Duplicates
   * (within the payload or against existing rows) are skipped via
   * `createMany({ skipDuplicates })`, which relies on the `keyword` unique
   * constraint. Inputs are trimmed; empty strings after trimming are dropped.
   * Writes a single AdminLog entry with the requested keywords.
   */
  async create(
    dto: AdminBannedKeywordCreateDto,
    adminId: number,
  ): Promise<{ success: true; count: number }> {
    const keywords = Array.from(
      new Set(
        dto.keywords
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      ),
    );

    if (keywords.length === 0) {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'create_banned_keyword',
          targetType: 'BannedKeyword',
          targetId: null,
          detail: { keywords, count: 0 },
        },
      });
      return { success: true, count: 0 };
    }

    const result = await this.prisma.bannedKeyword.createMany({
      data: keywords.map((keyword) => ({ keyword })),
      skipDuplicates: true,
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_banned_keyword',
        targetType: 'BannedKeyword',
        targetId: null,
        detail: { keywords, count: result.count },
      },
    });

    return { success: true, count: result.count };
  }

  /**
   * Delete a single banned keyword (DELETE /admin/banned-keywords/:id).
   * Writes an AdminLog entry capturing the deleted keyword text.
   */
  async remove(
    id: number,
    adminId: number,
  ): Promise<{ success: true }> {
    const existing = await this.prisma.bannedKeyword.findUnique({
      where: { id },
      select: { id: true, keyword: true },
    });
    if (!existing) {
      throw new NotFoundException('关键词不存在');
    }

    await this.prisma.bannedKeyword.delete({ where: { id } });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_banned_keyword',
        targetType: 'BannedKeyword',
        targetId: id,
        detail: { keyword: existing.keyword },
      },
    });

    return { success: true };
  }
}
