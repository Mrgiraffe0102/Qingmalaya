import { Injectable, NotFoundException } from '@nestjs/common';
import type { Banner, BannerWithMarkdown } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Fields selected for banner list responses (excludes markdownContent). */
const BANNER_LIST_SELECT = {
  id: true,
  title: true,
  coverPath: true,
  linkType: true,
  linkTarget: true,
  sort: true,
  status: true,
  startAt: true,
  endAt: true,
  createdAt: true,
} as const;

/**
 * Convert a Prisma Banner row to the shared Banner contract (dates → ISO strings).
 */
function toBanner(b: {
  id: number;
  title: string;
  coverPath: string;
  linkType: string;
  linkTarget: string | null;
  sort: number;
  status: string;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
}): Banner {
  return {
    id: b.id,
    title: b.title,
    coverPath: b.coverPath,
    linkType: b.linkType as Banner['linkType'],
    linkTarget: b.linkTarget,
    sort: b.sort,
    status: b.status as Banner['status'],
    startAt: b.startAt ? b.startAt.toISOString() : null,
    endAt: b.endAt ? b.endAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
  };
}

/**
 * Convert a Prisma Banner row (with markdownContent) to BannerWithMarkdown.
 */
function toBannerWithMarkdown(b: {
  id: number;
  title: string;
  coverPath: string;
  linkType: string;
  linkTarget: string | null;
  markdownContent: string | null;
  sort: number;
  status: string;
  startAt: Date | null;
  endAt: Date | null;
  createdAt: Date;
}): BannerWithMarkdown {
  return {
    ...toBanner(b),
    markdownContent: b.markdownContent,
  };
}

/**
 * Banner domain service. Banners are admin-curated discovery carousel items.
 * Only ONLINE banners within their active [startAt, endAt] window are shown.
 */
@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active banners: status = ONLINE and now is within [startAt, endAt]
   * (null startAt → -∞, null endAt → +∞). Ordered by sort asc, then id asc.
   * Excludes markdownContent to keep the list response small.
   */
  async findActive(): Promise<Banner[]> {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        status: 'ONLINE',
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: BANNER_LIST_SELECT,
    });
    return banners.map(toBanner);
  }

  /**
   * Single banner by id, including markdownContent. Used by the mobile
   * markdown page to render MARKDOWN-type banner content.
   */
  async findOne(id: number): Promise<BannerWithMarkdown> {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });
    if (!banner) {
      throw new NotFoundException('Banner不存在');
    }
    return toBannerWithMarkdown(banner);
  }
}
