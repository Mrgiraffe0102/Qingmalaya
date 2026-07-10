import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CommentWithUser,
  Paginated,
  UserSummary,
} from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * Prisma select projecting exactly the UserSummary fields. Shared by every
 * comment/reply query so the mapper can rely on the user shape being stable.
 */
const USER_SUMMARY_SELECT = {
  id: true,
  studentId: true,
  name: true,
  avatar: true,
  role: true,
  classId: true,
} as const satisfies Prisma.UserSelect;

/**
 * Build the include payload for a top-level comment: author, the current
 * user's like (if any) on it, and its visible replies (one level deep, each
 * with its own author + liked flag). `userId` scopes the `likes` relation so
 * we can compute `liked` without a separate query per comment.
 */
function commentInclude(userId: number) {
  return {
    user: { select: USER_SUMMARY_SELECT },
    likes: {
      where: { userId, targetType: 'COMMENT' as const },
      select: { id: true },
    },
    replies: {
      where: { status: 'VISIBLE' as const },
      orderBy: { createdAt: 'asc' as const },
      include: {
        user: { select: USER_SUMMARY_SELECT },
        likes: {
          where: { userId, targetType: 'COMMENT' as const },
          select: { id: true },
        },
      },
    },
  };
}

/** Inferred row type for a top-level comment fetched with `commentInclude`. */
type CommentRow = Prisma.CommentGetPayload<{
  include: ReturnType<typeof commentInclude>;
}>;

/** Shape of a newly created comment (author only, no replies yet). */
type CreatedRow = Prisma.CommentGetPayload<{
  include: { user: { select: typeof USER_SUMMARY_SELECT } };
}>;

/**
 * Map a Prisma comment row (with author + liked-flag likes + replies) to the
 * shared `CommentWithUser` shape. Date fields become ISO strings; the filtered
 * `likes` array collapses to a boolean `liked`. Replies are mapped one level
 * deep — we never fetch beyond the second level.
 */
function toCommentWithUser(c: CommentRow): CommentWithUser {
  return {
    id: c.id,
    podcastId: c.podcastId,
    userId: c.userId,
    content: c.content,
    parentId: c.parentId,
    likeCount: c.likeCount,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    user: toUserSummary(c.user),
    liked: c.likes.length > 0,
    replies: c.replies.map((r) => ({
      id: r.id,
      podcastId: r.podcastId,
      userId: r.userId,
      content: r.content,
      parentId: r.parentId,
      likeCount: r.likeCount,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: toUserSummary(r.user),
      liked: r.likes.length > 0,
    })),
  };
}

/** Narrow a Prisma user row (from USER_SUMMARY_SELECT) to UserSummary. */
function toUserSummary(u: {
  id: number;
  studentId: string;
  name: string;
  avatar: string | null;
  role: UserSummary['role'];
  classId: number | null;
}): UserSummary {
  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
    classId: u.classId,
  };
}

/** Clamp page/pageSize to sane bounds (used by the list endpoint). */
function clampPagination(page: number, pageSize: number): {
  page: number;
  pageSize: number;
} {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize >= 1
      ? Math.min(100, Math.floor(pageSize))
      : 20;
  return { page: safePage, pageSize: safePageSize };
}

/**
 * Comment domain service. Implements listing (paginated, nested replies),
 * creation (with 2-level reply validation), deletion (soft-hide when the
 * comment has replies, hard-delete otherwise), and like/unlike toggling.
 *
 * `podcast.commentCount` is kept in sync atomically via `prisma.$transaction`
 * for create/delete so the denormalized counter never drifts.
 */
@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * List visible top-level comments for a podcast, paginated, with one level
   * of visible replies nested under each. `total` counts only top-level
   * visible comments (replies are not counted, per spec).
   *
   * Auth is required upstream so `userId` is always present — it scopes the
   * `likes` include to compute the per-comment `liked` flag.
   */
  async listComments(
    podcastId: number,
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CommentWithUser>> {
    const { page: safePage, pageSize: safePageSize } = clampPagination(
      page,
      pageSize,
    );

    const where: Prisma.CommentWhereInput = {
      podcastId,
      parentId: null,
      status: 'VISIBLE',
    };

    const [total, rows] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        include: commentInclude(userId),
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      items: rows.map(toCommentWithUser),
      total,
      hasMore: safePage * safePageSize < total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * Create a comment (or reply) on a podcast.
   *
   * Validation:
   * - The podcast must exist and be PUBLISHED (404 otherwise).
   * - If `parentId` is given, the parent must exist, belong to the same
   *   podcast, and itself be a top-level comment — we only allow 2 levels, so
   *   replying to a reply is rejected with 400 "仅支持二级回复".
   *
   * On success the comment is created with status VISIBLE and the podcast's
   * `commentCount` is incremented atomically in the same transaction. A fresh
   * comment has no likes and no replies, so `liked` is false and `replies` is
   * empty in the response.
   */
  async createComment(
    podcastId: number,
    userId: number,
    dto: CreateCommentDto,
  ): Promise<CommentWithUser> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      select: { id: true, status: true, authorId: true, title: true },
    });
    if (!podcast || podcast.status !== 'PUBLISHED') {
      throw new NotFoundException('播客不存在或未发布');
    }

    if (dto.parentId !== null && dto.parentId !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, podcastId: true, parentId: true },
      });
      if (!parent) {
        throw new NotFoundException('父评论不存在');
      }
      if (parent.podcastId !== podcastId) {
        throw new BadRequestException('父评论不属于该播客');
      }
      // Only allow 2 levels: a reply's parent must itself be top-level.
      if (parent.parentId !== null) {
        throw new BadRequestException('仅支持二级回复');
      }
    }

    // Banned-keyword interception: reject the comment outright (not stored)
    // if the content matches any blacklisted word, case-insensitively.
    const banned = await this.prisma.bannedKeyword.findMany({
      select: { keyword: true },
    });
    if (banned.length > 0) {
      const lower = dto.content.toLowerCase();
      if (banned.some((b) => lower.includes(b.keyword.toLowerCase()))) {
        throw new BadRequestException('评论包含敏感词，请修改后重试');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          podcastId,
          userId,
          content: dto.content,
          parentId: dto.parentId ?? null,
          status: 'VISIBLE',
        },
        include: { user: { select: USER_SUMMARY_SELECT } },
      });
      await tx.podcast.update({
        where: { id: podcastId },
        data: { commentCount: { increment: 1 } },
      });
      return comment;
    });

    // Notify the podcast author (unless they're the commenter).
    if (userId !== podcast.authorId) {
      await this.notifications.createForUser(
        podcast.authorId,
        'PODCAST_COMMENTED',
        '播客收到新评论',
        `有人评论了您的播客《${podcast.title}》`,
        podcastId,
        userId,
      );
    }

    return toCreatedComment(created);
  }

  /**
   * Delete a comment. The author or any OPERATOR+ may delete.
   *
   * If the comment has replies (only possible for top-level comments since we
   * cap replies at level 2), it is soft-hidden and its content cleared so the
   * replies stay attached and the frontend can render "[已删除]". Otherwise the
   * row is hard-deleted. In both cases `podcast.commentCount` is decremented
   * atomically — the hidden comment no longer counts toward the visible total.
   */
  async deleteComment(
    commentId: number,
    userId: number,
    role: string,
  ): Promise<{ success: true }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, podcastId: true },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const isOwner = comment.userId === userId;
    const isOperatorPlus = role === 'OPERATOR' || role === 'SUPER_ADMIN';
    if (!isOwner && !isOperatorPlus) {
      throw new ForbiddenException('无权删除该评论');
    }

    const replyCount = await this.prisma.comment.count({
      where: { parentId: commentId },
    });

    await this.prisma.$transaction(async (tx) => {
      if (replyCount > 0) {
        // Soft-hide so child replies are not orphaned; frontend shows "[已删除]".
        await tx.comment.update({
          where: { id: commentId },
          data: { status: 'HIDDEN', content: '' },
        });
      } else {
        await tx.comment.delete({ where: { id: commentId } });
      }
      await tx.podcast.update({
        where: { id: comment.podcastId },
        data: { commentCount: { decrement: 1 } },
      });
    });

    return { success: true };
  }

  /**
   * Like a comment. Idempotent: if already liked, returns the current
   * likeCount unchanged. Otherwise creates the Like row (polymorphic
   * targetType=COMMENT + commentId FK) and increments `comment.likeCount`
   * atomically. A P2002 unique-constraint violation from a concurrent like is
   * treated as idempotent success.
   */
  async likeComment(
    commentId: number,
    userId: number,
  ): Promise<{ liked: true; likeCount: number }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likeCount: true },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const existing = await this.prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: 'COMMENT',
          targetId: commentId,
        },
      },
    });
    if (existing) {
      return { liked: true, likeCount: comment.likeCount };
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.like.create({
          data: {
            userId,
            targetType: 'COMMENT',
            targetId: commentId,
            commentId,
          },
        });
        return tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
      });
      return { liked: true, likeCount: updated.likeCount };
    } catch (e) {
      // Race: another request liked it first — treat as idempotent success.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const fresh = await this.prisma.comment.findUniqueOrThrow({
          where: { id: commentId },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: fresh.likeCount };
      }
      throw e;
    }
  }

  /**
   * Unlike a comment. Idempotent: if not liked, returns the current likeCount
   * unchanged. Otherwise deletes the Like row and decrements
   * `comment.likeCount` atomically.
   */
  async unlikeComment(
    commentId: number,
    userId: number,
  ): Promise<{ liked: false; likeCount: number }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likeCount: true },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const existing = await this.prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: 'COMMENT',
          targetId: commentId,
        },
      },
    });
    if (!existing) {
      return { liked: false, likeCount: comment.likeCount };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.like.delete({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'COMMENT',
            targetId: commentId,
          },
        },
      });
      return tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
    });
    return { liked: false, likeCount: updated.likeCount };
  }
}

/**
 * Map a freshly created comment row (author only) to `CommentWithUser`. A new
 * comment has no likes (so `liked: false`) and no replies (so `replies: []`).
 */
function toCreatedComment(c: CreatedRow): CommentWithUser {
  return {
    id: c.id,
    podcastId: c.podcastId,
    userId: c.userId,
    content: c.content,
    parentId: c.parentId,
    likeCount: c.likeCount,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    user: toUserSummary(c.user),
    liked: false,
    replies: [],
  };
}
