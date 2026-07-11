import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  User,
  Tag,
  PodcastWithRelations,
  PlayHistory,
  Paginated,
} from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Prisma `select` clause for the UserSummary shape embedded in podcast
 * responses. Using `satisfies` keeps the literal `true` values so Prisma's
 * payload type inference resolves each field as non-optional.
 */
const USER_SUMMARY_SELECT = {
  id: true,
  studentId: true,
  name: true,
  avatar: true,
  role: true,
  classId: true,
} satisfies Prisma.UserSelect;

/**
 * Prisma `include` clause for populating a Podcast with its author (UserSummary)
 * and tags. Tags come back as PodcastTag[] (join rows), mapped to Tag[] later.
 */
const PODCAST_INCLUDE = {
  author: { select: USER_SUMMARY_SELECT },
  tags: { include: { tag: true } },
} satisfies Prisma.PodcastInclude;

/** Inferred Prisma payload type for a podcast fetched with PODCAST_INCLUDE. */
type PodcastWithAuthorAndTags = Prisma.PodcastGetPayload<{
  include: typeof PODCAST_INCLUDE;
}>;

/**
 * Strip passwordHash and convert Date fields to ISO strings to match the
 * shared `User` contract. Mirrors the auth service's toSafeUser.
 */
function toSafeUser(
  user: NonNullable<
    Awaited<ReturnType<PrismaService['user']['findUnique']>>
  >,
): User {
  const { passwordHash: _omit, ...rest } = user;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  } as User;
}

/**
 * Convert a Prisma Tag row to the shared Tag contract.
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
 * Convert a Prisma podcast (with author + tags included) to the shared
 * PodcastWithRelations contract. `liked`/`favorited` are computed by the
 * caller from the Like/Favorite tables for the current user.
 */
function toPodcastWithRelations(
  p: PodcastWithAuthorAndTags,
  liked: boolean,
  favorited: boolean,
): PodcastWithRelations {
  return {
    id: p.id,
    title: p.title,
    // Shared type declares these as non-null strings; Prisma has them nullable.
    description: p.description ?? '',
    coverPath: p.coverPath ?? '',
    audioPath: p.audioPath,
    duration: p.duration,
    authorId: p.authorId,
    classId: p.classId,
    status: p.status as PodcastWithRelations['status'],
    playCount: p.playCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    author: p.author,
    tags: p.tags.map((pt) => toTag(pt.tag)),
    liked,
    favorited,
  };
}

/**
 * User domain service. Handles the authenticated user's profile, play
 * history, and favorites. All podcast joins are filtered to PUBLISHED
 * status so TAKEN_DOWN content is invisible.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Return the current user's profile (including totalListens/totalLikes),
   * with passwordHash stripped and dates as ISO strings.
   */
  async getMe(userId: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return toSafeUser(user);
  }

  /**
   * Update the current user's editable profile fields (name/avatar/bio).
   * Only provided fields are written; undefined fields are left untouched.
   */
  async updateMe(userId: number, dto: UpdateUserDto): Promise<User> {
    const data: { name?: string; avatar?: string; bio?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.bio !== undefined) data.bio = dto.bio;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    void this.activityLog.log({
      userId,
      action: 'UPDATE_PROFILE',
      targetType: 'User',
      targetId: userId,
      detail: { fields: Object.keys(data) },
    });
    return toSafeUser(user);
  }

  /**
   * Paginated play history for the current user, newest first. Each entry
   * includes the full podcast (with author + tags). TAKEN_DOWN podcasts
   * are excluded so the history doesn't surface removed content.
   */
  async getHistory(
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PlayHistory & { podcast: PodcastWithRelations }>> {
    const skip = (page - 1) * pageSize;
    const where = {
      userId,
      podcast: { status: 'PUBLISHED' as const },
    };

    const [total, records] = await Promise.all([
      this.prisma.playHistory.count({ where }),
      this.prisma.playHistory.findMany({
        where,
        include: { podcast: { include: PODCAST_INCLUDE } },
        orderBy: { playedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const podcastIds = records.map((r) => r.podcastId);
    const { likedSet, favoritedSet } = await this.getLikeFavoriteSets(
      userId,
      podcastIds,
    );

    const items = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      podcastId: r.podcastId,
      position: r.position,
      playedAt: r.playedAt.toISOString(),
      podcast: toPodcastWithRelations(
        r.podcast,
        likedSet.has(r.podcastId),
        favoritedSet.has(r.podcastId),
      ),
    }));

    return {
      items,
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }

  /**
   * Paginated favorited podcasts for the current user, most recently
   * favorited first. TAKEN_DOWN podcasts are excluded. Each podcast
   * includes author + tags; `favorited` is always true here, `liked`
   * reflects the user's like state.
   */
  async getFavorites(
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PodcastWithRelations>> {
    const skip = (page - 1) * pageSize;
    const where = {
      userId,
      podcast: { status: 'PUBLISHED' as const },
    };

    const [total, favorites] = await Promise.all([
      this.prisma.favorite.count({ where }),
      this.prisma.favorite.findMany({
        where,
        include: { podcast: { include: PODCAST_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const podcastIds = favorites.map((f) => f.podcastId);
    const { likedSet } = await this.getLikeFavoriteSets(userId, podcastIds);

    const items = favorites.map((f) =>
      toPodcastWithRelations(f.podcast, likedSet.has(f.podcastId), true),
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
   * All podcasts authored by the current user, newest first — used by the
   * 创作 page. Unlike history/favorites, this returns EVERY status
   * (PENDING/PUBLISHED/TAKEN_DOWN) so the author can see their drafts and
   * taken-down work. Each podcast includes author + tags plus the user's
   * liked/favorited state.
   */
  async getMyPodcasts(userId: number): Promise<PodcastWithRelations[]> {
    const podcasts = await this.prisma.podcast.findMany({
      where: { authorId: userId },
      include: PODCAST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const podcastIds = podcasts.map((p) => p.id);
    const { likedSet, favoritedSet } = await this.getLikeFavoriteSets(
      userId,
      podcastIds,
    );

    return podcasts.map((p) =>
      toPodcastWithRelations(p, likedSet.has(p.id), favoritedSet.has(p.id)),
    );
  }

  /**
   * Batch-fetch the current user's like + favorite state for a set of
   * podcast IDs. Returns two Sets for O(1) lookup when mapping podcast
   * lists. Short-circuits to empty sets when there are no IDs to query.
   */
  private async getLikeFavoriteSets(
    userId: number,
    podcastIds: number[],
  ): Promise<{ likedSet: Set<number>; favoritedSet: Set<number> }> {
    if (podcastIds.length === 0) {
      return { likedSet: new Set<number>(), favoritedSet: new Set<number>() };
    }

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

    return {
      likedSet: new Set(likes.map((l) => l.targetId)),
      favoritedSet: new Set(favorites.map((f) => f.podcastId)),
    };
  }
}
