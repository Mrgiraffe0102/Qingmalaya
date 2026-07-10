import { Injectable } from '@nestjs/common';
import { TagColor } from '@qingmalaya/shared';
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
   * Top 6 tags by weight for the upload page's "热门标签快捷选择" quick picker.
   */
  async findHot(): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: [{ weight: 'desc' }, { id: 'asc' }],
      take: 6,
    });
    return tags.map(toTag);
  }

  /**
   * Find a tag by name, or create it if it doesn't exist.
   * Used by the upload page when a user types a new tag name.
   */
  async findOrCreate(name: string): Promise<Tag> {
    const existing = await this.prisma.tag.findUnique({ where: { name } });
    if (existing) return toTag(existing);
    const colors = Object.values(TagColor);
    const tag = await this.prisma.tag.create({
      data: {
        name,
        weight: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
      },
    });
    return toTag(tag);
  }
}
