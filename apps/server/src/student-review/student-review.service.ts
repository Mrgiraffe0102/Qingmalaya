import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PodcastWithRelations,
  ReviewAssignment,
} from '@qingmalaya/shared';
import { COMMON_REJECT_REASONS } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentReviewActionDto } from './dto/student-review-action.dto';

/**
 * Prisma include for a podcast with author (UserSummary) + tags, matching the
 * shape used by the users service and admin content service. Reused for the
 * student review queue so the mapper produces a consistent PodcastWithRelations.
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

type PodcastRow = Prisma.PodcastGetPayload<{
  include: typeof PODCAST_INCLUDE;
}>;

/** Map a Prisma podcast row to the shared PodcastWithRelations shape. */
function toPodcastWithRelations(row: PodcastRow): PodcastWithRelations {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    coverPath: row.coverPath ?? '',
    audioPath: row.audioPath,
    duration: row.duration,
    authorId: row.authorId,
    classId: row.classId,
    status: row.status as PodcastWithRelations['status'],
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
 * Combine reason-tag indices (into COMMON_REJECT_REASONS) and free-text
 * reason into a single human-readable string. Mirrors the helper in
 * admin-content.service.ts — kept duplicated to avoid a cross-module
 * dependency on an internal helper.
 */
function combineRejectReason(
  reasonTags?: number[],
  reason?: string,
): string | null {
  const parts: string[] = [];
  if (reasonTags && reasonTags.length > 0) {
    for (const idx of reasonTags) {
      if (idx >= 0 && idx < COMMON_REJECT_REASONS.length) {
        parts.push(COMMON_REJECT_REASONS[idx]);
      }
    }
  }
  if (reason && reason.trim()) {
    parts.push(reason.trim());
  }
  return parts.length > 0 ? parts.join('；') : null;
}

/**
 * Student admin review service.
 *
 * Computes dynamic review assignments (consecutive student-ID ranges with
 * rotation so no admin reviews their own chunk), lists the assigned review
 * queue, and processes review actions (approve/flag/reject).
 *
 * The assignment is recomputed on each call — no DB persistence — so it
 * always reflects the current class roster.
 */
@Injectable()
export class StudentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * GET /student-review/assignment — compute the review assignment for the
   * current student admin. Returns the studentId range they're responsible
   * for, the IDs of other student admins whose podcasts they review, and a
   * human-readable summary.
   */
  async getAssignment(userId: number): Promise<ReviewAssignment> {
    const { admins, nonAdminStudents, j } =
      await this.getContext(userId);

    const N = admins.length;
    if (N === 0) {
      return { studentRange: null, adminAuthorIds: [], summary: '暂无分配' };
    }

    // Split non-admin students into N consecutive chunks by index.
    const chunks = this.splitIntoChunks(nonAdminStudents, N);
    // This admin reviews the chunk at (j - 1 + N) % N — rotation by 1 so no
    // admin reviews their own chunk when they're adjacent in the sorted list.
    const myChunk = chunks[(j - 1 + N) % N] ?? [];

    const studentRange =
      myChunk.length > 0
        ? {
            from: myChunk[0].studentId,
            to: myChunk[myChunk.length - 1].studentId,
          }
        : null;

    // Also review the next admin's podcasts (mutual review).
    const nextAdmin = N > 1 ? admins[(j + 1) % N] : null;
    const adminAuthorIds = nextAdmin ? [nextAdmin.id] : [];

    const summary = studentRange
      ? `负责学号 ${studentRange.from} ~ ${studentRange.to} 的播客审核${
          nextAdmin ? `，以及学生管理员 ${nextAdmin.name} 的播客` : ''
        }`
      : '暂无分配的非管理员学生播客';

    return { studentRange, adminAuthorIds, summary };
  }

  /**
   * GET /student-review/queue — list PENDING podcasts the student admin
   * should review. Includes podcasts from students in their assigned range
   * and from the next admin author. Excludes the admin's own podcasts.
   */
  async getQueue(userId: number): Promise<PodcastWithRelations[]> {
    const { user, admins, nonAdminStudents, j } =
      await this.getContext(userId);

    const N = admins.length;
    if (N === 0) return [];

    const chunks = this.splitIntoChunks(nonAdminStudents, N);
    const myChunk = chunks[(j - 1 + N) % N] ?? [];
    const nextAdmin = N > 1 ? admins[(j + 1) % N] : null;

    // Collect author IDs from the assigned range + next admin's id.
    const assignedAuthorIds = myChunk.map((s) => s.id);
    if (nextAdmin) {
      assignedAuthorIds.push(nextAdmin.id);
    }

    if (assignedAuthorIds.length === 0) return [];

    const rows = await this.prisma.podcast.findMany({
      where: {
        status: 'PENDING',
        classId: user.classId,
        authorId: { in: assignedAuthorIds, not: userId },
      },
      include: PODCAST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toPodcastWithRelations);
  }

  /**
   * POST /student-review/:podcastId/review — submit a review action.
   *
   * APPROVE: set PUBLISHED + publishedAt, create PodcastReview(APPROVE),
   *   notify the author.
   * FLAG: set FLAGGED, create PodcastReview(FLAG, reason), notify the class
   *   teacher(s) so they can make a final decision.
   * REJECT: set TAKEN_DOWN, create PodcastReview(REJECT, combinedReason),
   *   notify the author with the reason.
   */
  async review(
    podcastId: number,
    dto: StudentReviewActionDto,
    userId: number,
  ): Promise<{ success: true }> {
    const { user, admins, nonAdminStudents, j } =
      await this.getContext(userId);

    const N = admins.length;
    const chunks = this.splitIntoChunks(nonAdminStudents, N);
    const myChunk = chunks[(j - 1 + N) % N] ?? [];
    const nextAdmin = N > 1 ? admins[(j + 1) % N] : null;

    const assignedAuthorIds = new Set(myChunk.map((s) => s.id));
    if (nextAdmin) assignedAuthorIds.add(nextAdmin.id);

    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      select: {
        id: true,
        title: true,
        authorId: true,
        classId: true,
        status: true,
        publishedAt: true,
      },
    });
    if (!podcast) {
      throw new NotFoundException('播客不存在');
    }
    if (podcast.status !== 'PENDING') {
      throw new ForbiddenException('该播客不在待审核状态');
    }
    if (podcast.classId !== user.classId) {
      throw new ForbiddenException('只能审核本班级的播客');
    }
    if (podcast.authorId === userId) {
      throw new ForbiddenException('不能审核自己的播客');
    }
    if (!assignedAuthorIds.has(podcast.authorId)) {
      throw new ForbiddenException('该播客不在您的审核范围内');
    }

    switch (dto.action) {
      case 'APPROVE':
        await this.approve(podcast, userId);
        break;
      case 'FLAG':
        await this.flag(podcast, userId, dto);
        break;
      case 'REJECT':
        await this.reject(podcast, userId, dto);
        break;
    }

    return { success: true };
  }

  // --- Private helpers ---

  /** Approve a podcast: set PUBLISHED, create review record, notify author. */
  private async approve(
    podcast: {
      id: number;
      title: string;
      authorId: number;
      publishedAt: Date | null;
    },
    reviewerId: number,
  ): Promise<void> {
    const data: Prisma.PodcastUpdateInput = { status: 'PUBLISHED' };
    if (!podcast.publishedAt) {
      data.publishedAt = new Date();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.podcast.update({ where: { id: podcast.id }, data });
      await tx.podcastReview.create({
        data: {
          podcastId: podcast.id,
          reviewerId,
          action: 'APPROVE',
        },
      });
    });

    await this.notifications.createForUser(
      podcast.authorId,
      'PODCAST_APPROVED',
      '播客审核通过',
      `您的播客《${podcast.title}》已审核通过，现已发布`,
      podcast.id,
    );
  }

  /** Flag a podcast: set FLAGGED, create review record with reason, notify teacher(s). */
  private async flag(
    podcast: {
      id: number;
      title: string;
      authorId: number;
      classId: number | null;
    },
    reviewerId: number,
    dto: StudentReviewActionDto,
  ): Promise<void> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new ForbiddenException('存疑需要填写存疑点');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.podcast.update({
        where: { id: podcast.id },
        data: { status: 'FLAGGED' },
      });
      await tx.podcastReview.create({
        data: {
          podcastId: podcast.id,
          reviewerId,
          action: 'FLAG',
          reason,
        },
      });
    });

    // Notify the teacher(s) managing this class.
    const teacherIds = await this.getClassTeacherIds(podcast.classId);
    for (const tid of teacherIds) {
      await this.notifications.createForUser(
        tid,
        'PODCAST_FLAGGED',
        '播客存疑待裁决',
        `学生管理员对播客《${podcast.title}》标记存疑：${reason}`,
        podcast.id,
      );
    }
  }

  /** Reject a podcast: set TAKEN_DOWN, create review record with reason, notify author. */
  private async reject(
    podcast: {
      id: number;
      title: string;
      authorId: number;
    },
    reviewerId: number,
    dto: StudentReviewActionDto,
  ): Promise<void> {
    const combinedReason = combineRejectReason(dto.reasonTags, dto.reason);

    await this.prisma.$transaction(async (tx) => {
      await tx.podcast.update({
        where: { id: podcast.id },
        data: { status: 'TAKEN_DOWN' },
      });
      await tx.podcastReview.create({
        data: {
          podcastId: podcast.id,
          reviewerId,
          action: 'REJECT',
          reason: combinedReason,
        },
      });
    });

    await this.notifications.createForUser(
      podcast.authorId,
      'PODCAST_REJECTED',
      '播客审核未通过',
      `您的播客《${podcast.title}》审核未通过${
        combinedReason ? `，原因：${combinedReason}` : ''
      }`,
      podcast.id,
    );
  }

  /**
   * Fetch the student admin's context: the user, all admins in the class,
   * non-admin students, and the admin's index. Throws 403 if the user is not
   * a student admin.
   */
  private async getContext(userId: number): Promise<{
    user: { id: number; classId: number | null; isStudentAdmin: boolean };
    admins: { id: number; studentId: string; name: string }[];
    nonAdminStudents: { id: number; studentId: string; name: string }[];
    j: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, classId: true, isStudentAdmin: true },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (!user.isStudentAdmin) {
      throw new ForbiddenException('只有学生管理员可以审核播客');
    }
    if (user.classId === null) {
      throw new ForbiddenException('您未分配到任何班级');
    }

    // All students in the class sorted by studentId.
    const allStudents = await this.prisma.user.findMany({
      where: { classId: user.classId, role: 'STUDENT' },
      select: { id: true, studentId: true, name: true, isStudentAdmin: true },
      orderBy: { studentId: 'asc' },
    });

    const admins = allStudents
      .filter((s) => s.isStudentAdmin)
      .map((s) => ({ id: s.id, studentId: s.studentId, name: s.name }));
    const nonAdminStudents = allStudents
      .filter((s) => !s.isStudentAdmin)
      .map((s) => ({ id: s.id, studentId: s.studentId, name: s.name }));

    const j = admins.findIndex((a) => a.id === userId);
    if (j === -1) {
      throw new ForbiddenException('您不是该班级的学生管理员');
    }

    return { user, admins, nonAdminStudents, j };
  }

  /**
   * Split an array into N consecutive chunks as evenly as possible. The first
   * (arr.length % N) chunks get one extra element to distribute the remainder.
   */
  private splitIntoChunks<T>(arr: T[], n: number): T[][] {
    if (n <= 0) return [];
    const chunks: T[][] = [];
    const baseSize = Math.floor(arr.length / n);
    const remainder = arr.length % n;
    let offset = 0;
    for (let i = 0; i < n; i++) {
      const size = baseSize + (i < remainder ? 1 : 0);
      chunks.push(arr.slice(offset, offset + size));
      offset += size;
    }
    return chunks;
  }

  /**
   * Find all teacher IDs managing the given class: teachers assigned via
   * TeacherClass, plus teachers with manageAllClasses=true.
   */
  private async getClassTeacherIds(classId: number | null): Promise<number[]> {
    if (classId === null) return [];
    const assigned = await this.prisma.teacherClass.findMany({
      where: { classId },
      select: { teacherId: true },
    });
    const allClass = await this.prisma.user.findMany({
      where: { role: 'TEACHER', manageAllClasses: true },
      select: { id: true },
    });
    return [...new Set([
      ...assigned.map((t) => t.teacherId),
      ...allClass.map((t) => t.id),
    ])];
  }
}
