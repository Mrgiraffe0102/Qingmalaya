import { Injectable } from '@nestjs/common';
import type { Tag } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Convert a Prisma Tag row to the shared Tag contract (dates → ISO strings).
 */
function toTag(tag: {
  id: number;
  name: string;
  weight: number;
  color: string;
  createdAt: Date;
}): Tag {
  return {
    id: tag.id,
    name: tag.name,
    weight: tag.weight,
    color: tag.color as Tag['color'],
    createdAt: tag.createdAt.toISOString(),
  };
}

/**
 * Tag domain service. Tags are admin-managed reference data used by the
 * upload page's tag selector. Weight controls display order.
 */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All tags ordered by weight desc (highest priority first), then id asc.
   * Used by the upload page's full tag selector.
   */
  async findAll(): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: [{ weight: 'desc' }, { id: 'asc' }],
    });
    return tags.map(toTag);
  }

  /**
   * Top 8 tags by weight for the upload page's "热门标签快捷选择" quick picker.
   */
  async findHot(): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: [{ weight: 'desc' }, { id: 'asc' }],
      take: 8,
    });
    return tags.map(toTag);
  }
}
