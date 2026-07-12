import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Class, Paginated, User } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminCreateClassDto,
  AdminImportStudentsDto,
  AdminUpdateClassDto,
} from './dto/admin-classes.dto';
import { AdminUserCreateDto } from './dto/admin-user-create.dto';
import { AdminUserBatchDeleteDto } from './dto/admin-user-batch-delete.dto';

/**
 * User row projected for the admin list view. Extends the shared `User`
 * contract with the user's class name (null when unaffiliated) and a
 * `totalPodcasts` count derived from the Podcast relation.
 */
export interface AdminUserListItem extends User {
  className: string | null;
  totalPodcasts: number;
}

/**
 * Class row projected for the admin class list view. Extends the shared
 * `Class` contract with user/podcast counts.
 */
export interface AdminClassListItem extends Class {
  userCount: number;
  podcastCount: number;
}

/** Result shape returned by POST /admin/classes/:id/import. */
export interface ImportStudentsResult {
  created: number;
  skipped: number;
  errors: string[];
}

/** Result shape returned by POST /admin/users/:id/reset-password. */
export interface ResetPasswordResult {
  newPassword: string;
}

/**
 * Prisma `select` clause for the admin user list. Excludes passwordHash,
 * includes the class name and a podcast count via _count.
 */
const ADMIN_USER_SELECT = {
  id: true,
  studentId: true,
  name: true,
  classId: true,
  role: true,
  avatar: true,
  bio: true,
  totalListens: true,
  totalLikes: true,
  status: true,
  firstLogin: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { name: true } },
  _count: { select: { podcasts: true } },
} satisfies Prisma.UserSelect;

/** Inferred Prisma payload type for the admin user list select. */
type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;

/**
 * Map a Prisma user row (with class + podcast count) to the AdminUserListItem
 * contract. Date fields are converted to ISO strings to satisfy the shared
 * `User` type; nullable grade is not part of User so it's omitted here.
 */
function toAdminUserListItem(row: AdminUserRow): AdminUserListItem {
  return {
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    classId: row.classId,
    role: row.role,
    avatar: row.avatar,
    bio: row.bio,
    totalListens: row.totalListens,
    totalLikes: row.totalLikes,
    status: row.status,
    firstLogin: row.firstLogin,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    className: row.class?.name ?? null,
    totalPodcasts: row._count.podcasts,
  };
}

/**
 * Map a Prisma class row (with user/podcast counts) to the AdminClassListItem
 * contract. Nullable grade is coerced to empty string to satisfy the shared
 * `Class` type.
 */
function toAdminClassListItem(
  row: Prisma.ClassGetPayload<{
    select: {
      id: true;
      name: true;
      grade: true;
      createdAt: true;
      _count: { select: { users: true; podcasts: true } };
    };
  }>,
): AdminClassListItem {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade ?? '',
    createdAt: row.createdAt.toISOString(),
    userCount: row._count.users,
    podcastCount: row._count.podcasts,
  };
}

/**
 * Admin user management service. Handles the user list (search + class filter
 * + pagination), user creation (STUDENT/TEACHER), ban/unban, and password
 * reset. Each mutation writes an AdminLog entry for auditability.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** bcrypt cost factor — matches the seed script and admin-auth.service. */
  private static readonly BCRYPT_COST = 10;

  /**
   * Paginated user list. `keyword` matches studentId OR name (contains);
   * `classId` filters by class membership. Each item carries the user's class
   * name and podcast count. passwordHash is never selected.
   */
  async list(params: {
    keyword?: string;
    classId?: number;
    page: number;
    pageSize: number;
  }): Promise<Paginated<AdminUserListItem>> {
    const { keyword, classId, page, pageSize } = params;

    const where: Prisma.UserWhereInput = {};
    if (keyword) {
      where.OR = [
        { studentId: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }
    if (classId) {
      where.classId = classId;
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map(toAdminUserListItem);
    return {
      items,
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }

  /**
   * Create a new STUDENT or TEACHER account. Checks for a duplicate studentId,
   * validates the classId (when provided), hashes the password with bcrypt, and
   * forces mustChangePassword=true. Writes an AdminLog entry tagged create_user.
   */
  async create(dto: AdminUserCreateDto, adminId: number): Promise<AdminUserListItem> {
    const existing = await this.prisma.user.findUnique({
      where: { studentId: dto.studentId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('该学号已存在');
    }

    if (dto.classId !== undefined) {
      const cls = await this.prisma.class.findUnique({
        where: { id: dto.classId },
        select: { id: true },
      });
      if (!cls) {
        throw new BadRequestException(`班级 ${dto.classId} 不存在`);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, AdminUsersService.BCRYPT_COST);
    const created = await this.prisma.user.create({
      data: {
        studentId: dto.studentId,
        name: dto.name,
        passwordHash,
        role: dto.role,
        classId: dto.classId ?? null,
        status: 'ACTIVE',
        mustChangePassword: true,
        firstLogin: true,
      },
      select: ADMIN_USER_SELECT,
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_user',
        targetType: 'User',
        targetId: created.id,
        detail: { studentId: dto.studentId, name: dto.name, role: dto.role, classId: dto.classId ?? null },
      },
    });

    return toAdminUserListItem(created);
  }

  /**
   * Ban a user (set status BANNED). Throws NotFoundException if the user
   * doesn't exist. Writes an AdminLog entry tagged ban_user.
   */
  async ban(id: number, adminId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, studentId: true, status: true },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'BANNED' },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'ban_user',
        targetType: 'User',
        targetId: id,
        detail: { studentId: user.studentId, before: user.status, after: 'BANNED' },
      },
    });
  }

  /**
   * Unban a user (set status ACTIVE). Throws NotFoundException if the user
   * doesn't exist. Writes an AdminLog entry tagged unban_user.
   */
  async unban(id: number, adminId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, studentId: true, status: true },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'unban_user',
        targetType: 'User',
        targetId: id,
        detail: { studentId: user.studentId, before: user.status, after: 'ACTIVE' },
      },
    });
  }

  /**
   * Reset a user's password to a deterministic value derived from their
   * studentId: the last 6 digits when studentId is purely numeric, otherwise
   * the full studentId. The new password is hashed with bcrypt (cost 10) and
   * mustChangePassword is forced so the student is prompted on next login.
   * Returns the plaintext newPassword so the operator can communicate it.
   */
  async resetPassword(
    id: number,
    adminId: number,
  ): Promise<ResetPasswordResult> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, studentId: true },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    const newPassword = /^\d+$/.test(user.studentId)
      ? user.studentId.slice(-6)
      : user.studentId;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'reset_password',
        targetType: 'User',
        targetId: id,
        detail: { studentId: user.studentId },
      },
    });

    return { newPassword };
  }

  /**
   * Delete a user (DELETE /admin/users/:id). Prevents deleting SUPER_ADMIN
   * accounts and self-deletion. Inside a transaction:
   *   1. Decrement commentCount on podcasts where the user commented, then
   *      delete the user's comments (Comment.userId is a required FK).
   *   2. Delete the user's podcasts — cascade handles PodcastTag, Comment,
   *      Favorite, PlayHistory, CollectionPodcast; Like.podcastId and
   *      Notification.podcastId are SetNull.
   *   3. Delete AdminLog rows authored by this user (required FK, no cascade).
   *   4. Delete the user — cascade handles Like, Favorite, PlayHistory,
   *      UserActivityLog, Notification (as recipient); Notification.actorId
   *      is SetNull.
   * Writes an AdminLog entry before the user's logs are purged (the entry
   * itself survives because it's created by the admin, not the deleted user).
   */
  async remove(id: number, adminId: number): Promise<void> {
    if (id === adminId) {
      throw new ForbiddenException('不能删除自己的账号');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, studentId: true, name: true, role: true },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('不能删除超级管理员账号');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Decrement commentCount on affected podcasts, then delete comments.
      const comments = await tx.comment.findMany({
        where: { userId: id },
        select: { podcastId: true },
      });
      const commentCountByPodcast = new Map<number, number>();
      for (const c of comments) {
        commentCountByPodcast.set(
          c.podcastId,
          (commentCountByPodcast.get(c.podcastId) ?? 0) + 1,
        );
      }
      for (const [podcastId, count] of commentCountByPodcast) {
        await tx.podcast.update({
          where: { id: podcastId },
          data: { commentCount: { decrement: count } },
        });
      }
      await tx.comment.deleteMany({ where: { userId: id } });

      // 2. Delete the user's podcasts (cascade handles related rows).
      await tx.podcast.deleteMany({ where: { authorId: id } });

      // 3. Delete AdminLog entries authored by this user (required FK).
      await tx.adminLog.deleteMany({ where: { adminId: id } });

      // 4. Delete the user (cascade handles remaining relations).
      await tx.user.delete({ where: { id } });
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_user',
        targetType: 'User',
        targetId: id,
        detail: { studentId: user.studentId, name: user.name, role: user.role },
      },
    });
  }

  /**
   * Batch delete users (POST /admin/users/batch-delete). Same per-user logic
   * as `remove`, applied to each ID. SUPER_ADMIN accounts and the caller's own
   * ID are skipped (counted in `skipped`). A single AdminLog entry is written.
   */
  async batchRemove(
    dto: AdminUserBatchDeleteDto,
    adminId: number,
  ): Promise<{ success: true; count: number; skipped: number }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, studentId: true, name: true, role: true },
    });

    const deletable = users.filter(
      (u) => u.role !== 'SUPER_ADMIN' && u.id !== adminId,
    );
    const skipped = users.length - deletable.length;

    if (deletable.length === 0) {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'batch_delete_user',
          targetType: 'User',
          targetId: null,
          detail: { ids: dto.ids, count: 0, skipped },
        },
      });
      return { success: true, count: 0, skipped };
    }

    const deletableIds = deletable.map((u) => u.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Decrement commentCount on affected podcasts, then delete comments.
      const comments = await tx.comment.findMany({
        where: { userId: { in: deletableIds } },
        select: { podcastId: true },
      });
      const commentCountByPodcast = new Map<number, number>();
      for (const c of comments) {
        commentCountByPodcast.set(
          c.podcastId,
          (commentCountByPodcast.get(c.podcastId) ?? 0) + 1,
        );
      }
      for (const [podcastId, count] of commentCountByPodcast) {
        await tx.podcast.update({
          where: { id: podcastId },
          data: { commentCount: { decrement: count } },
        });
      }
      await tx.comment.deleteMany({
        where: { userId: { in: deletableIds } },
      });

      // 2. Delete the users' podcasts (cascade handles related rows).
      await tx.podcast.deleteMany({
        where: { authorId: { in: deletableIds } },
      });

      // 3. Delete AdminLog entries authored by these users.
      await tx.adminLog.deleteMany({
        where: { adminId: { in: deletableIds } },
      });

      // 4. Delete the users (cascade handles remaining relations).
      await tx.user.deleteMany({
        where: { id: { in: deletableIds } },
      });
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'batch_delete_user',
        targetType: 'User',
        targetId: null,
        detail: {
          ids: deletableIds,
          count: deletable.length,
          skipped,
          users: deletable.map((u) => ({
            studentId: u.studentId,
            name: u.name,
            role: u.role,
          })),
        },
      },
    });

    return { success: true, count: deletable.length, skipped };
  }
}

/**
 * Admin class management service. Handles class list (with user/podcast
 * counts), create/update/delete (rejecting delete when the class still has
 * users), and batch student import from pasted `studentId,name` lines.
 */
@Injectable()
export class AdminClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all classes with user and podcast counts. Ordered by id ascending
   * for stable display. No pagination — the class catalog is small.
   */
  async list(): Promise<AdminClassListItem[]> {
    const rows = await this.prisma.class.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        createdAt: true,
        _count: { select: { users: true, podcasts: true } },
      },
      orderBy: { id: 'asc' },
    });
    return rows.map(toAdminClassListItem);
  }

  /** Create a new class. Writes an AdminLog entry tagged create_class. */
  async create(
    dto: AdminCreateClassDto,
    adminId: number,
  ): Promise<AdminClassListItem> {
    const created = await this.prisma.class.create({
      data: { name: dto.name, grade: dto.grade },
      select: {
        id: true,
        name: true,
        grade: true,
        createdAt: true,
        _count: { select: { users: true, podcasts: true } },
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_class',
        targetType: 'Class',
        targetId: created.id,
        detail: { name: created.name, grade: created.grade },
      },
    });

    return toAdminClassListItem(created);
  }

  /**
   * Update a class's name/grade. Throws NotFoundException if the class doesn't
   * exist. Writes an AdminLog entry tagged update_class with before/after
   * snapshots.
   */
  async update(
    id: number,
    dto: AdminUpdateClassDto,
    adminId: number,
  ): Promise<AdminClassListItem> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`班级 ${id} 不存在`);
    }

    const updated = await this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        grade: dto.grade,
      },
      select: {
        id: true,
        name: true,
        grade: true,
        createdAt: true,
        _count: { select: { users: true, podcasts: true } },
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_class',
        targetType: 'Class',
        targetId: id,
        detail: {
          before: {
            name: existing.name,
            grade: existing.grade,
          },
          after: {
            name: updated.name,
            grade: updated.grade,
          },
        },
      },
    });

    return toAdminClassListItem(updated);
  }

  /**
   * Delete a class. Rejects with BadRequestException if the class still has
   * users (avoiding orphaning students). Podcasts are allowed to remain
   * (their classId is nullable). Writes an AdminLog entry tagged delete_class.
   */
  async remove(id: number, adminId: number): Promise<void> {
    const existing = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`班级 ${id} 不存在`);
    }
    if (existing._count.users > 0) {
      throw new BadRequestException(
        `班级「${existing.name}」仍有 ${existing._count.users} 名学生，无法删除`,
      );
    }

    await this.prisma.class.delete({ where: { id } });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_class',
        targetType: 'Class',
        targetId: id,
        detail: { name: existing.name },
      },
    });
  }

  /**
   * Batch-import students into a class from pasted `studentId,name` lines.
   * Each non-empty line is split on the first comma or tab. New users are
   * created with role STUDENT, passwordHash = bcrypt(studentId) (full
   * studentId), mustChangePassword = true, firstLogin = true. Lines whose
   * studentId already exists (in the DB or earlier in the same batch) are
   * counted as skipped. Malformed lines are reported in `errors` without
   * aborting the rest of the batch. Writes a single AdminLog entry tagged
   * import_students summarizing the result.
   */
  async importStudents(
    classId: number,
    dto: AdminImportStudentsDto,
    adminId: number,
  ): Promise<ImportStudentsResult> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) {
      throw new NotFoundException(`班级 ${classId} 不存在`);
    }

    // Parse lines into { studentId, name } pairs, collecting per-line errors.
    const parsed: { studentId: string; name: string; lineNo: number }[] = [];
    const errors: string[] = [];
    const rawLines = dto.lines.split(/\r?\n/);
    rawLines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const trimmed = raw.trim();
      if (!trimmed) return; // skip blank lines
      const parts = trimmed.split(/[,\t]/).map((s) => s.trim()).filter((s) => s.length > 0);
      if (parts.length < 2) {
        errors.push(`第 ${lineNo} 行：格式错误，应为「学号,姓名」`);
        return;
      }
      const [studentId, ...rest] = parts;
      const name = rest.join(''); // rejoin in case name had no separator issue
      if (!studentId || !name) {
        errors.push(`第 ${lineNo} 行：学号或姓名为空`);
        return;
      }
      parsed.push({ studentId, name, lineNo });
    });

    // Dedupe within the batch (keep first occurrence), recording later dupes as errors.
    const seenInBatch = new Set<string>();
    const unique: { studentId: string; name: string }[] = [];
    for (const p of parsed) {
      if (seenInBatch.has(p.studentId)) {
        errors.push(`第 ${p.lineNo} 行：学号 ${p.studentId} 在本次导入中重复，已跳过`);
        continue;
      }
      seenInBatch.add(p.studentId);
      unique.push({ studentId: p.studentId, name: p.name });
    }

    // Find which studentIds already exist in the DB.
    const studentIds = unique.map((u) => u.studentId);
    const existing = await this.prisma.user.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingSet = new Set(existing.map((e) => e.studentId));

    const toCreate = unique.filter((u) => !existingSet.has(u.studentId));
    const skipped = unique.length - toCreate.length;

    // Hash passwords in parallel (bcrypt is CPU-bound but Promise.all still
    // concurrent on the libuv pool for the native binding).
    const records = await Promise.all(
      toCreate.map(async (u) => ({
        studentId: u.studentId,
        name: u.name,
        classId,
        role: 'STUDENT' as const,
        passwordHash: await bcrypt.hash(u.studentId, 10),
        mustChangePassword: true,
        firstLogin: true,
      })),
    );

    if (records.length > 0) {
      // skipDuplicates guards against a race where a studentId is created
      // between our findMany and createMany — those rows are simply dropped.
      await this.prisma.user.createMany({
        data: records,
        skipDuplicates: true,
      });
    }

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'import_students',
        targetType: 'Class',
        targetId: classId,
        detail: {
          className: cls.name,
          created: records.length,
          skipped,
          errors,
        },
      },
    });

    return { created: records.length, skipped, errors };
  }
}
