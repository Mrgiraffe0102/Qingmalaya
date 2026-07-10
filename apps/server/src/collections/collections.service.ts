import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CollectionWithPodcasts } from '@qingmalaya/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PODCAST_INCLUDE = {
  author: {
    select: {
      id: true,
      studentId: true,
      name: true,
      avatar: true,
      role: true,
      classId: true,
    },
  },
  tags: { include: { tag: true } },
} satisfies Prisma.PodcastInclude;

type PodcastWithRelationsRow = Prisma.PodcastGetPayload<{
  include: typeof PODCAST_INCLUDE;
}>;

function toPodcastWithRelations(row: PodcastWithRelationsRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    coverPath: row.coverPath ?? '',
    audioPath: row.audioPath,
    duration: row.duration,
    authorId: row.authorId,
    classId: row.classId,
    status: row.status,
    playCount: row.playCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: {
      id: row.author.id,
      studentId: row.author.studentId,
      name: row.author.name,
      avatar: row.author.avatar,
      role: row.author.role,
      classId: row.author.classId,
    },
    tags: row.tags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      weight: pt.tag.weight,
      color: pt.tag.color,
      createdAt: pt.tag.createdAt.toISOString(),
    })),
  };
}

/**
 * Public Collection service.
 *
 * Returns a single ONLINE collection with its podcasts (author + tags
 * populated), ordered by CollectionPodcast.sort then podcast id.
 */
@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number): Promise<CollectionWithPodcasts> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        podcasts: {
          orderBy: [{ sort: 'asc' }, { podcastId: 'asc' }],
          include: { podcast: { include: PODCAST_INCLUDE } },
        },
      },
    });

    if (!collection || collection.status !== 'ONLINE') {
      throw new NotFoundException('精选集不存在或已下线');
    }

    return {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      coverPath: collection.coverPath,
      sort: collection.sort,
      status: collection.status,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      podcasts: collection.podcasts.map((cp) =>
        toPodcastWithRelations(cp.podcast),
      ),
    };
  }
}
