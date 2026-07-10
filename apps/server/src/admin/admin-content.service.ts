import { Injectable, NotFoundException } from '@nestjs/common';
import { PodcastStatus, Prisma } from '@prisma/client';
import type {
  Paginated,
  PodcastWithRelations,
  UserSummary,
} from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminPodcastListDto } from './dto/admin-podcast-list.dto';
import { AdminPodcastUpdateDto } from './dto/admin-podcast-update.dto';
import { AdminPodcastBatchTakedownDto } from './dto/admin-podcast-batch-takedown.dto';
import { AdminPodcastBatchPublishDto } from './dto/admin-podcast-batch-publish.dto';
import { AdminPodcastBatchTagDto } from './dto/admin-podcast-batch-tag.dto';
import { AdminCommentListDto } from './dto/admin-comment-list.dto';

/**
 * Prisma include shape for a podcast with its author (UserSummary projection)
 * and tags (PodcastTag join rows with the Tag nested). Reused across every
 * admin podcast read so the mapper always sees a consistent row shape.
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

/** Prisma select projecting exactly the UserSummary fields for comment authors. */
const USER_SUMMARY_SELECT = {
  id: true,
  studentId: true,
  name: true,
  avatar: true,
  role: true,
  classId: true,
} as const satisfies Prisma.UserSelect;

/**
 * Map a Prisma podcast row (author + tags included) to the shared
 * `PodcastWithRelations` shape. Date fields are converted to ISO strings and
 * nullable description/coverPath are coerced to empty strings to satisfy the
 * shared type contract. `liked`/`favorited` are intentionally omitted on the
 * admin side (the admin console doesn't show per-user like state).
 */
function toPodcastWithRelations(row: PodcastWithRelationsRow): PodcastWithRelations {
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
 * Admin-side comment list item — extends the shared Comment shape with the
 * author (UserSummary) and a lightweight podcast reference (id + title). Kept
 * inline here (not in @qingmalaya/shared) because it's admin-only and not
 * part of the public API contract.
 */
export interface AdminCommentListItem {
  id: number;
  podcastId: number;
  userId: number;
  content: string;
  parentId: number | null;
  likeCount: number;
  status: string;
  createdAt: string;
  user: UserSummary;
  podcast: { id: number; title: string };
}

/** Inferred row type for a comment fetched with author + podcast title. */
type AdminCommentRow = Prisma.CommentGetPayload<{
  include: {
    user: { select: typeof USER_SUMMARY_SELECT };
    podcast: { select: { id: true; title: true } };
  };
}>;

/** Map a Prisma comment row to the AdminCommentListItem shape. */
function toAdminCommentListItem(c: AdminCommentRow): AdminCommentListItem {
  return {
    id: c.id,
    podcastId: c.podcastId,
    userId: c.userId,
    content: c.content,
    parentId: c.parentId,
    likeCount: c.likeCount,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    user: {
      id: c.user.id,
      studentId: c.user.studentId,
      name: c.user.name,
      avatar: c.user.avatar,
      role: c.user.role,
      classId: c.user.classId,
    },
    podcast: { id: c.podcast.id, title: c.podcast.title },
  };
}

/**
 * Admin podcast + comment management services (Tasks 27 + 28).
 *
 * `AdminPodcastsService` implements list/detail/edit/takedown/publish plus
 * batch-takedown and batch-tag for the admin console. `AdminCommentsService`
 * implements list/delete/batch-delete. Every mutation writes an AdminLog row
 * so the action is auditable.
 */
@Injectable()
export class AdminPodcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Lightweight id+title list of PUBLISHED podcasts for selectors
   * (GET /admin/podcasts/options). Capped at 500 to avoid huge payloads.
   */
  async options(): Promise<{ id: number; title: string }[]> {
    const rows = await this.prisma.podcast.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows;
  }

  /**
   * Paginated, filtered podcast list (GET /admin/podcasts). Returns ALL
   * statuses (PENDING/PUBLISHED/TAKEN_DOWN) — the admin console needs to see
   * pending and taken-down podcasts too. Each item carries the author
   * (UserSummary) and tags. Ordered by createdAt desc (newest first).
   */
  async list(dto: AdminPodcastListDto): Promise<Paginated<PodcastWithRelations>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: Prisma.PodcastWhereInput = {};
    if (dto.keyword) {
      where.title = { contains: dto.keyword };
    }
    if (dto.status) {
      where.status = dto.status as PodcastStatus;
    }

    const [total, rows] = await Promise.all([
      this.prisma.podcast.count({ where }),
      this.prisma.podcast.findMany({
        where,
        include: PODCAST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toPodcastWithRelations),
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }

  /**
   * Single-podcast detail (GET /admin/podcasts/:id). Returns author + tags.
   * `commentCount` is part of the PodcastWithRelations shape (denormalized
   * counter on the Podcast row). Throws 404 when the podcast is missing.
   */
  async detail(id: number): Promise<PodcastWithRelations> {
    const row = await this.prisma.podcast.findUnique({
      where: { id },
      include: PODCAST_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('播客不存在');
    }
    return toPodcastWithRelations(row);
  }

  /**
   * Edit podcast metadata (PUT /admin/podcasts/:id). When `tagIds` is supplied
   * the existing PodcastTag rows are replaced atomically (deleteMany + create).
   * Writes an AdminLog entry capturing the changed fields.
   */
  async update(
    id: number,
    dto: AdminPodcastUpdateDto,
    adminId: number,
  ): Promise<PodcastWithRelations> {
    const existing = await this.prisma.podcast.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('播客不存在');
    }

    const data: Prisma.PodcastUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverPath !== undefined) data.coverPath = dto.coverPath;
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

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_podcast',
        targetType: 'Podcast',
        targetId: id,
        detail: {
          title: dto.title,
          description: dto.description,
          coverPath: dto.coverPath,
          tagIds: dto.tagIds,
        },
      },
    });

    return toPodcastWithRelations(row);
  }

  /**
   * Take a podcast down (PUT /admin/podcasts/:id/takedown). Sets status to
   * TAKEN_DOWN so the podcast is hidden from students but retained for audit.
   * Idempotent — taking down an already-taken-down podcast is a no-op on
   * status (the AdminLog is still written). Notifies the author.
   */
  async takedown(id: number, adminId: number): Promise<{ success: true }> {
    const existing = await this.prisma.podcast.findUnique({
      where: { id },
      select: { id: true, title: true, authorId: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('播客不存在');
    }

    await this.prisma.podcast.update({
      where: { id },
      data: { status: 'TAKEN_DOWN' },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'takedown_podcast',
        targetType: 'Podcast',
        targetId: id,
        detail: {},
      },
    });

    // Notify the author — differentiate rejection (was PENDING) vs takedown (was PUBLISHED).
    const wasPublished = existing.status === 'PUBLISHED';
    await this.notifications.createForUser(
      existing.authorId,
      'PODCAST_REJECTED',
      wasPublished ? '播客已下架' : '播客审核未通过',
      wasPublished
        ? `您的播客《${existing.title}》已被下架`
        : `您的播客《${existing.title}》审核未通过`,
      id,
    );

    return { success: true };
  }

  /**
   * Publish a podcast (PUT /admin/podcasts/:id/publish). Sets status to
   * PUBLISHED and stamps publishedAt = now (only on first publish —
   * re-publishing after takedown preserves the original publishedAt). Writes
   * an AdminLog entry. Notifies the author.
   */
  async publish(id: number, adminId: number): Promise<{ success: true }> {
    const existing = await this.prisma.podcast.findUnique({
      where: { id },
      select: { id: true, publishedAt: true, title: true, authorId: true },
    });
    if (!existing) {
      throw new NotFoundException('播客不存在');
    }

    // Only stamp publishedAt on first publish; re-publish keeps original date.
    const data: Prisma.PodcastUpdateInput = { status: 'PUBLISHED' };
    if (!existing.publishedAt) {
      data.publishedAt = new Date();
    }

    await this.prisma.podcast.update({ where: { id }, data });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'publish_podcast',
        targetType: 'Podcast',
        targetId: id,
        detail: {},
      },
    });

    await this.notifications.createForUser(
      existing.authorId,
      'PODCAST_APPROVED',
      '播客审核通过',
      `您的播客《${existing.title}》已审核通过，现已发布`,
      id,
    );

    return { success: true };
  }

  /**
   * Batch takedown (POST /admin/podcasts/batch-takedown). Sets status to
   * TAKEN_DOWN for every podcast in `ids`. Missing IDs are silently skipped
   * (updateMany matches only existing rows). A single AdminLog entry is
   * written with the full ID list. Each author is notified.
   */
  async batchTakedown(
    dto: AdminPodcastBatchTakedownDto,
    adminId: number,
  ): Promise<{ success: true; count: number }> {
    const podcasts = await this.prisma.podcast.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, title: true, authorId: true, status: true },
    });

    const result = await this.prisma.podcast.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: 'TAKEN_DOWN' },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'batch_takedown_podcast',
        targetType: 'Podcast',
        targetId: null,
        detail: { ids: dto.ids, count: result.count },
      },
    });

    for (const p of podcasts) {
      const wasPublished = p.status === 'PUBLISHED';
      await this.notifications.createForUser(
        p.authorId,
        'PODCAST_REJECTED',
        wasPublished ? '播客已下架' : '播客审核未通过',
        wasPublished
          ? `您的播客《${p.title}》已被下架`
          : `您的播客《${p.title}》审核未通过`,
        p.id,
      );
    }

    return { success: true, count: result.count };
  }

  /**
   * Batch publish (POST /admin/podcasts/batch-publish). Sets status to
   * PUBLISHED for every podcast in `ids`. publishedAt is stamped only on
   * first publish (re-publishing after takedown preserves the original date),
   * matching the single-publish semantics. Done as two updateMany calls
   * because Prisma can't conditionally set a field per-row: the first sets
   * status for all matched rows; the second stamps publishedAt=now for the
   * subset that had no publishedAt. Missing IDs are silently skipped. A
   * single AdminLog entry is written with the full ID list. Each author is
   * notified.
   */
  async batchPublish(
    dto: AdminPodcastBatchPublishDto,
    adminId: number,
  ): Promise<{ success: true; count: number }> {
    const podcasts = await this.prisma.podcast.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, title: true, authorId: true },
    });

    const result = await this.prisma.podcast.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: 'PUBLISHED' },
    });

    if (result.count > 0) {
      await this.prisma.podcast.updateMany({
        where: { id: { in: dto.ids }, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'batch_publish_podcast',
        targetType: 'Podcast',
        targetId: null,
        detail: { ids: dto.ids, count: result.count },
      },
    });

    for (const p of podcasts) {
      await this.notifications.createForUser(
        p.authorId,
        'PODCAST_APPROVED',
        '播客审核通过',
        `您的播客《${p.title}》已审核通过，现已发布`,
        p.id,
      );
    }

    return { success: true, count: result.count };
  }

  /**
   * Batch tag (POST /admin/podcasts/batch-tag). Adds `tagIds` to every podcast
   * in `ids` with merge semantics — existing tags are preserved, duplicates
   * are skipped via PodcastTag's composite PK + `createMany({ skipDuplicates })`.
   * A single AdminLog entry is written.
   */
  async batchTag(
    dto: AdminPodcastBatchTagDto,
    adminId: number,
  ): Promise<{ success: true; count: number }> {
    // Only pair tags with podcasts that actually exist; missing IDs are skipped.
    const podcasts = await this.prisma.podcast.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true },
    });

    if (podcasts.length === 0) {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'batch_tag_podcast',
          targetType: 'Podcast',
          targetId: null,
          detail: { ids: dto.ids, tagIds: dto.tagIds, count: 0 },
        },
      });
      return { success: true, count: 0 };
    }

    const pairs: { podcastId: number; tagId: number }[] = [];
    for (const p of podcasts) {
      for (const tagId of dto.tagIds) {
        pairs.push({ podcastId: p.id, tagId });
      }
    }

    // createMany with skipDuplicates relies on the [podcastId, tagId]
    // composite PK to no-op pairs that already exist.
    await this.prisma.podcastTag.createMany({
      data: pairs,
      skipDuplicates: true,
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'batch_tag_podcast',
        targetType: 'Podcast',
        targetId: null,
        detail: {
          ids: dto.ids,
          tagIds: dto.tagIds,
          count: podcasts.length,
        },
      },
    });

    return { success: true, count: podcasts.length };
  }
}

/**
 * Admin comment management service. Implements list (filtered by podcast/user/
 * keyword/date range) and delete (single + batch). Deletion mirrors the user-
 * facing flow: a comment with replies is soft-hidden (so child replies are not
 * orphaned), otherwise hard-deleted. `podcast.commentCount` is decremented
 * atomically in both cases via a transaction.
 */
@Injectable()
export class AdminCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated, filtered comment list (GET /admin/comments). Each item carries
   * the author (UserSummary) and a lightweight podcast reference (id + title).
   * Ordered by createdAt desc (newest first). Date bounds are inclusive.
   */
  async list(
    dto: AdminCommentListDto,
  ): Promise<Paginated<AdminCommentListItem>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where: Prisma.CommentWhereInput = {};
    if (dto.podcastId !== undefined) {
      where.podcastId = dto.podcastId;
    }
    if (dto.userId !== undefined) {
      where.userId = dto.userId;
    }
    if (dto.keyword) {
      where.content = { contains: dto.keyword };
    }
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) {
        where.createdAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        // endDate is inclusive — advance to end of day so a YYYY-MM-DD bound
        // captures comments posted that day.
        const end = new Date(dto.endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        include: {
          user: { select: USER_SUMMARY_SELECT },
          podcast: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toAdminCommentListItem),
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }

  /**
   * Delete a single comment (DELETE /admin/comments/:id). If the comment has
   * replies it is soft-hidden (status=HIDDEN, content cleared) so child replies
   * stay attached and the frontend can render "[已删除]". Otherwise the row is
   * hard-deleted. In both cases `podcast.commentCount` is decremented
   * atomically in the same transaction. Writes an AdminLog entry.
   */
  async delete(
    commentId: number,
    adminId: number,
  ): Promise<{ success: true }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, podcastId: true, content: true },
    });
    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    const replyCount = await this.prisma.comment.count({
      where: { parentId: commentId },
    });

    await this.prisma.$transaction(async (tx) => {
      if (replyCount > 0) {
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

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_comment',
        targetType: 'Comment',
        targetId: commentId,
        detail: {
          podcastId: comment.podcastId,
          content: comment.content,
          softHidden: replyCount > 0,
        },
      },
    });

    return { success: true };
  }

  /**
   * Batch delete comments (POST /admin/comments/batch-delete). Applies the
   * same soft-hide-vs-hard-delete logic as `delete` per comment, decrementing
   * each affected podcast.commentCount within a single transaction. Missing
   * IDs are silently skipped. Writes a single AdminLog entry.
   */
  async batchDelete(
    ids: number[],
    adminId: number,
  ): Promise<{ success: true; count: number }> {
    const comments = await this.prisma.comment.findMany({
      where: { id: { in: ids } },
      select: { id: true, podcastId: true, content: true },
    });

    if (comments.length === 0) {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'batch_delete_comment',
          targetType: 'Comment',
          targetId: null,
          detail: { ids, count: 0 },
        },
      });
      return { success: true, count: 0 };
    }

    // Fetch reply counts for all comments being deleted in one query.
    const replies = await this.prisma.comment.findMany({
      where: { parentId: { in: ids } },
      select: { parentId: true },
    });
    const replyCountMap = new Map<number, number>();
    for (const r of replies) {
      if (r.parentId !== null) {
        replyCountMap.set(r.parentId, (replyCountMap.get(r.parentId) ?? 0) + 1);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const comment of comments) {
        const hasReplies = (replyCountMap.get(comment.id) ?? 0) > 0;
        if (hasReplies) {
          await tx.comment.update({
            where: { id: comment.id },
            data: { status: 'HIDDEN', content: '' },
          });
        } else {
          await tx.comment.delete({ where: { id: comment.id } });
        }
        await tx.podcast.update({
          where: { id: comment.podcastId },
          data: { commentCount: { decrement: 1 } },
        });
      }
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'batch_delete_comment',
        targetType: 'Comment',
        targetId: null,
        detail: { ids, count: comments.length },
      },
    });

    return { success: true, count: comments.length };
  }
}
