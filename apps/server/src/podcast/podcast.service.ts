import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DiscoveryResponse,
  Paginated,
  PlayProgressResponse,
  PodcastWithRelations,
} from '@qingmalaya/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePodcastDto } from './dto/create-podcast.dto';
import { UpdatePodcastDto } from './dto/update-podcast.dto';
import { ListPodcastDto } from './dto/list-podcast.dto';

/**
 * Prisma include shape for a podcast with its author (UserSummary projection)
 * and tags (PodcastTag join rows with the Tag nested). Reused across every
 * read so the mapper always sees a consistent row shape.
 */
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

/** Inferred row type returned by Prisma when using PODCAST_INCLUDE. */
type PodcastWithRelationsRow = Prisma.PodcastGetPayload<{
  include: typeof PODCAST_INCLUDE;
}>;

/**
 * Map a Prisma podcast row (author + tags included) to the shared
 * `PodcastWithRelations` shape. Date fields are converted to ISO strings and
 * nullable description/coverPath are coerced to empty strings to satisfy the
 * shared type contract. `liked`/`favorited` are only attached when explicitly
 * provided (omitted for discovery to keep the payload small).
 */
function toPodcastWithRelations(
  row: PodcastWithRelationsRow,
  opts?: { liked?: boolean; favorited?: boolean },
): PodcastWithRelations {
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
    ...(opts && opts.liked !== undefined ? { liked: opts.liked } : {}),
    ...(opts && opts.favorited !== undefined ? { favorited: opts.favorited } : {}),
  };
}

/** Build the Prisma orderBy input for a given sort option. */
function orderByForSort(
  sort: string,
): Prisma.PodcastOrderByWithRelationInput {
  switch (sort) {
    case 'oldest':
      return { publishedAt: 'asc' };
    case 'name':
      return { title: 'asc' };
    case 'likes':
      return { likeCount: 'desc' };
    case 'views':
      return { playCount: 'desc' };
    case 'newest':
    default:
      return { publishedAt: 'desc' };
  }
}

/**
 * Podcast domain service. Implements the discovery aggregate, filtered list,
 * detail, CRUD, like/unlike toggling (atomic counters), and play tracking
 * (resume position). All read paths return the shared `PodcastWithRelations`
 * shape via the `toPodcastWithRelations` mapper.
 */
@Injectable()
export class PodcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Discovery aggregate (GET /podcasts/discovery). Returns online banners in
   * their time window, three hot-podcast leaderboards (by play/like/comment
   * counts, top 10 each), the 10 newest published podcasts, and up to 10
   * newest published podcasts from the current user's classmates. liked/
   * favorited flags are intentionally omitted to keep the payload small.
   */
  async discovery(userId: number): Promise<DiscoveryResponse> {
    const now = new Date();
    const publishedWhere: Prisma.PodcastWhereInput = { status: 'PUBLISHED' };

    const [banners, byPlay, byLike, byComment, recent, me] = await Promise.all([
      this.prisma.banner.findMany({
        where: {
          status: 'ONLINE',
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
        orderBy: { sort: 'asc' },
      }),
      this.prisma.podcast.findMany({
        where: publishedWhere,
        include: PODCAST_INCLUDE,
        orderBy: { playCount: 'desc' },
        take: 10,
      }),
      this.prisma.podcast.findMany({
        where: publishedWhere,
        include: PODCAST_INCLUDE,
        orderBy: { likeCount: 'desc' },
        take: 10,
      }),
      this.prisma.podcast.findMany({
        where: publishedWhere,
        include: PODCAST_INCLUDE,
        orderBy: { commentCount: 'desc' },
        take: 10,
      }),
      this.prisma.podcast.findMany({
        where: publishedWhere,
        include: PODCAST_INCLUDE,
        orderBy: { publishedAt: 'desc' },
        take: 10,
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { classId: true },
      }),
    ]);

    // Classmates: 10 newest published podcasts authored by other users in
    // the current user's class. Empty when the user has no class assignment.
    let classmates: PodcastWithRelationsRow[] = [];
    if (me?.classId) {
      classmates = await this.prisma.podcast.findMany({
        where: {
          ...publishedWhere,
          classId: me.classId,
          authorId: { not: userId },
        },
        include: PODCAST_INCLUDE,
        orderBy: { publishedAt: 'desc' },
        take: 10,
      });
    }

    const mapRows = (rows: PodcastWithRelationsRow[]): PodcastWithRelations[] =>
      rows.map((r) => toPodcastWithRelations(r));

    return {
      banners: banners.map((b) => ({
        id: b.id,
        title: b.title,
        coverPath: b.coverPath,
        linkType: b.linkType,
        linkTarget: b.linkTarget,
        sort: b.sort,
        status: b.status,
        startAt: b.startAt ? b.startAt.toISOString() : null,
        endAt: b.endAt ? b.endAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
      hot: {
        byPlay: mapRows(byPlay),
        byLike: mapRows(byLike),
        byComment: mapRows(byComment),
      },
      recent: mapRows(recent),
      classmates: mapRows(classmates),
    };
  }

  /**
   * Filtered, paginated list of published podcasts (GET /podcasts). Supports
   * sort, tag multi-select (OR semantics — podcasts matching any tag), classId,
   * and keyword (title contains, case-insensitive in MySQL). When the caller is
   * authenticated, each item is annotated with liked/favorited flags fetched in
   * batch to avoid N+1 queries.
   */
  async list(
    dto: ListPodcastDto,
    userId?: number,
  ): Promise<Paginated<PodcastWithRelations>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const sort = dto.sort ?? 'newest';

    const where: Prisma.PodcastWhereInput = { status: 'PUBLISHED' };
    if (dto.tag && dto.tag.length > 0) {
      where.tags = { some: { tagId: { in: dto.tag } } };
    }
    if (dto.classId !== undefined) {
      where.classId = dto.classId;
    }
    if (dto.keyword) {
      where.title = { contains: dto.keyword };
    }

    const [total, rows] = await Promise.all([
      this.prisma.podcast.count({ where }),
      this.prisma.podcast.findMany({
        where,
        include: PODCAST_INCLUDE,
        orderBy: orderByForSort(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Batch-fetch the current user's likes + favorites for just the page's
    // podcast IDs so we can annotate each item without per-row queries.
    let likedIds = new Set<number>();
    let favoritedIds = new Set<number>();
    if (userId && rows.length > 0) {
      const podcastIds = rows.map((r) => r.id);
      const [likes, favorites] = await Promise.all([
        this.prisma.like.findMany({
          where: {
            userId,
            targetType: 'PODCAST',
            targetId: { in: podcastIds },
          },
          select: { targetId: true },
        }),
        this.prisma.favorite.findMany({
          where: { userId, podcastId: { in: podcastIds } },
          select: { podcastId: true },
        }),
      ]);
      likedIds = new Set(likes.map((l) => l.targetId));
      favoritedIds = new Set(favorites.map((f) => f.podcastId));
    }

    const items = rows.map((r) =>
      toPodcastWithRelations(r, {
        liked: userId ? likedIds.has(r.id) : undefined,
        favorited: userId ? favoritedIds.has(r.id) : undefined,
      }),
    );

    return {
      items,
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }

  /**
   * Single-podcast detail (GET /podcasts/:id). Returns author + tags + liked
   * + favorited for the current user. Throws 404 when the podcast is missing
   * or not PUBLISHED so non-published states are never leaked to students.
   */
  async detail(
    id: number,
    userId: number,
  ): Promise<PodcastWithRelations> {
    const row = await this.prisma.podcast.findUnique({
      where: { id },
      include: PODCAST_INCLUDE,
    });
    if (!row || row.status !== 'PUBLISHED') {
      throw new NotFoundException('播客不存在或已下架');
    }

    const [like, favorite] = await Promise.all([
      this.prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'PODCAST',
            targetId: id,
          },
        },
      }),
      this.prisma.favorite.findUnique({
        where: { userId_podcastId: { userId, podcastId: id } },
      }),
    ]);

    return toPodcastWithRelations(row, {
      liked: !!like,
      favorited: !!favorite,
    });
  }

  /**
   * Create a new podcast (POST /podcasts). The new record is authored by the
   * current user, inherits their classId, and starts in PENDING status with
   * publishedAt = null (an operator/admin publishes it separately). tagIds are
   * connected via PodcastTag join rows.
   */
  async create(
    dto: CreatePodcastDto,
    userId: number,
  ): Promise<PodcastWithRelations> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { classId: true },
    });
    if (!me) {
      throw new NotFoundException('用户不存在');
    }

    const tagIds = dto.tagIds ?? [];
    const row = await this.prisma.podcast.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        coverPath: dto.coverPath,
        audioPath: dto.audioPath,
        duration: dto.duration,
        authorId: userId,
        classId: me.classId,
        status: 'PENDING',
        publishedAt: null,
        tags:
          tagIds.length > 0
            ? {
                create: tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              }
            : undefined,
      },
      include: PODCAST_INCLUDE,
    });
    return toPodcastWithRelations(row);
  }

  /**
   * Update a podcast (PUT /podcasts/:id). Only the author or an OPERATOR+
   * user may edit. When tagIds is supplied, the existing PodcastTag rows are
   * replaced atomically (deleteMany + create).
   */
  async update(
    id: number,
    dto: UpdatePodcastDto,
    userId: number,
    userRole: string,
  ): Promise<PodcastWithRelations> {
    const existing = await this.prisma.podcast.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) {
      throw new NotFoundException('播客不存在');
    }
    if (
      existing.authorId !== userId &&
      userRole !== 'OPERATOR' &&
      userRole !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('只能编辑自己的播客');
    }

    const data: Prisma.PodcastUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverPath !== undefined) data.coverPath = dto.coverPath;
    if (dto.audioPath !== undefined) data.audioPath = dto.audioPath;
    if (dto.duration !== undefined) data.duration = dto.duration;
    if (dto.tagIds !== undefined) {
      data.tags = {
        deleteMany: {},
        create: dto.tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      };
    }

    const row = await this.prisma.podcast.update({
      where: { id },
      data,
      include: PODCAST_INCLUDE,
    });
    return toPodcastWithRelations(row);
  }

  /**
   * Delete a podcast (DELETE /podcasts/:id). Only the author or an OPERATOR+
   * user may delete. Cascading deletes (configured in schema.prisma) clean up
   * PodcastTag/Comment/Like/Favorite/PlayHistory rows. User.totalLikes/
   * totalListens counters are intentionally left untouched (see task notes).
   */
  async remove(
    id: number,
    userId: number,
    userRole: string,
  ): Promise<{ success: true }> {
    const existing = await this.prisma.podcast.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) {
      throw new NotFoundException('播客不存在');
    }
    if (
      existing.authorId !== userId &&
      userRole !== 'OPERATOR' &&
      userRole !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('只能删除自己的播客');
    }
    await this.prisma.podcast.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Like a podcast (POST /podcasts/:id/like). Idempotent — if already liked,
   * returns the current state without changes. Otherwise, within a transaction,
   * creates the Like row (polymorphic targetType=PODCAST plus the optional
   * podcastId FK), increments the podcast.likeCount, and increments the
   * author's totalLikes (likes received across their podcasts). Notifies the
   * podcast author (unless the liker is the author).
   */
  async like(
    id: number,
    userId: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const podcast = await this.assertPublished(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'PODCAST',
            targetId: id,
          },
        },
      });
      if (existing) {
        const current = await tx.podcast.findUnique({
          where: { id },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: current?.likeCount ?? 0, isNew: false };
      }

      await tx.like.create({
        data: { userId, targetType: 'PODCAST', targetId: id, podcastId: id },
      });
      const updated = await tx.podcast.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      await tx.user.update({
        where: { id: podcast.authorId },
        data: { totalLikes: { increment: 1 } },
      });
      return { liked: true, likeCount: updated.likeCount, isNew: true };
    });

    if (result.isNew && userId !== podcast.authorId) {
      await this.notifications.createForUser(
        podcast.authorId,
        'PODCAST_LIKED',
        '播客收到新的点赞',
        `有人赞了您的播客《${podcast.title}》`,
        id,
        userId,
      );
    }

    return { liked: result.liked, likeCount: result.likeCount };
  }

  /**
   * Unlike a podcast (DELETE /podcasts/:id/like). Idempotent — if not liked,
   * returns the current state. Otherwise, within a transaction, deletes the
   * Like row, decrements the podcast.likeCount, and decrements the author's
   * totalLikes.
   */
  async unlike(
    id: number,
    userId: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const podcast = await this.assertPublished(id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'PODCAST',
            targetId: id,
          },
        },
      });
      if (!existing) {
        const current = await tx.podcast.findUnique({
          where: { id },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: current?.likeCount ?? 0 };
      }

      await tx.like.delete({ where: { id: existing.id } });
      const updated = await tx.podcast.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      await tx.user.update({
        where: { id: podcast.authorId },
        data: { totalLikes: { decrement: 1 } },
      });
      return { liked: false, likeCount: updated.likeCount };
    });
  }

  /**
   * Favorite a podcast (POST /podcasts/:id/favorite). Idempotent — if already
   * favorited, returns the current state. Uses upsert on the compound unique
   * key (userId, podcastId).
   */
  async favorite(
    id: number,
    userId: number,
  ): Promise<{ favorited: boolean }> {
    await this.assertPublished(id);
    await this.prisma.favorite.upsert({
      where: { userId_podcastId: { userId, podcastId: id } },
      create: { userId, podcastId: id },
      update: {},
    });
    return { favorited: true };
  }

  /**
   * Unfavorite a podcast (DELETE /podcasts/:id/favorite). Idempotent — if not
   * favorited, returns the current state.
   */
  async unfavorite(
    id: number,
    userId: number,
  ): Promise<{ favorited: boolean }> {
    await this.assertPublished(id);
    await this.prisma.favorite.deleteMany({
      where: { userId, podcastId: id },
    });
    return { favorited: false };
  }

  /**
   * Play tracking (POST /podcasts/:id/play). On the user's FIRST play of a
   * podcast (no existing PlayHistory), increments podcast.playCount and the
   * author's totalListens, then creates the PlayHistory row. On subsequent
   * reports (e.g. every 5 seconds), only the position + playedAt are updated.
   * Returns the LAST SAVED position (before this update) so the client can
   * resume playback.
   */
  async play(
    id: number,
    userId: number,
    position: number,
  ): Promise<PlayProgressResponse> {
    const podcast = await this.assertPublished(id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.playHistory.findFirst({
        where: { userId, podcastId: id },
      });
      const previousPosition = existing?.position ?? 0;

      if (!existing) {
        // First play by this user — bump play counts and seed the history row.
        await tx.podcast.update({
          where: { id },
          data: { playCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: podcast.authorId },
          data: { totalListens: { increment: 1 } },
        });
        await tx.playHistory.create({
          data: { userId, podcastId: id, position },
        });
      } else {
        await tx.playHistory.update({
          where: { id: existing.id },
          data: { position, playedAt: new Date() },
        });
      }

      return { position: previousPosition };
    });
  }

  /**
   * Load a podcast and throw 404 if it is missing or not PUBLISHED. Centralized
   * so the like/unlike/play paths share the same visibility check.
   */
  private async assertPublished(
    id: number,
  ): Promise<{ id: number; authorId: number; title: string }> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true, title: true },
    });
    if (!podcast || podcast.status !== 'PUBLISHED') {
      throw new NotFoundException('播客不存在或已下架');
    }
    return { id: podcast.id, authorId: podcast.authorId, title: podcast.title };
  }
}
