import { Injectable } from '@nestjs/common';
import type { Announcement } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Convert a Prisma Announcement row to the shared Announcement contract
 * (dates → ISO strings).
 */
function toAnnouncement(a: {
  id: number;
  title: string;
  content: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
}): Announcement {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    status: a.status as Announcement['status'],
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Announcement domain service. Admin-published platform announcements
 * surfaced on the discovery page.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Most recent PUBLISHED announcement by publishedAt desc.
   * Returns null when none exists so the frontend can treat it as "no announcement".
   */
  async findLatest(): Promise<Announcement | null> {
    const announcement = await this.prisma.announcement.findFirst({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
    });
    return announcement ? toAnnouncement(announcement) : null;
  }
}
