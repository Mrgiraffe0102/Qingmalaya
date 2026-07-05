import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User, Paginated } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAdminCreateDto } from './dto/admin-admin-create.dto';
import { AdminAdminUpdateDto } from './dto/admin-admin-update.dto';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';

/** Prisma User row including the passwordHash column. */
type UserWithPassword = Awaited<
  ReturnType<PrismaService['user']['findUnique']>
>;

/**
 * Strip passwordHash and serialize Date fields as ISO strings so the response
 * matches the shared `User` interface (which has no passwordHash and uses
 * ISODateString for all temporal fields).
 */
function toSafeUser(user: NonNullable<UserWithPassword>): User {
  const { passwordHash: _omit, ...rest } = user;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  } as User;
}

/** AdminLog row joined with the acting admin's name. */
export interface AdminLogWithAdmin {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  detail: unknown;
  createdAt: string;
}

/** bcrypt cost factor — matches the seed script and admin-auth.service. */
const BCRYPT_COST = 10;

/**
 * Admin account management (SUPER_ADMIN only). Handles creation, role/password
 * updates, and deletion — guarding against self-deletion and the removal of
 * the last remaining SUPER_ADMIN. Every mutation writes an AdminLog row.
 */
@Injectable()
export class AdminAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List every OPERATOR / SUPER_ADMIN account, newest first. */
  async list(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: { in: ['OPERATOR', 'SUPER_ADMIN'] } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSafeUser);
  }

  /** Create a new admin account. Forces mustChangePassword=true. */
  async create(dto: AdminAdminCreateDto, adminId: number): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { studentId: dto.studentId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('该用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const created = await this.prisma.user.create({
      data: {
        studentId: dto.studentId,
        name: dto.name,
        passwordHash,
        role: dto.role,
        status: 'ACTIVE',
        mustChangePassword: true,
        firstLogin: true,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'create_admin',
        targetType: 'User',
        targetId: created.id,
        detail: { studentId: dto.studentId, name: dto.name, role: dto.role },
      },
    });

    return toSafeUser(created);
  }

  /** Update an admin's name / role / password. */
  async update(
    id: number,
    dto: AdminAdminUpdateDto,
    adminId: number,
  ): Promise<User> {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('管理员不存在');
    }

    // Downgrading the last SUPER_ADMIN would orphan the platform — block it.
    if (
      dto.role &&
      dto.role !== 'SUPER_ADMIN' &&
      target.role === 'SUPER_ADMIN'
    ) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('至少需要保留一位超级管理员');
      }
    }

    const data: {
      name?: string;
      role?: 'OPERATOR' | 'SUPER_ADMIN';
      passwordHash?: string;
      mustChangePassword?: boolean;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
      data.mustChangePassword = true;
    }

    const updated = await this.prisma.user.update({ where: { id }, data });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_admin',
        targetType: 'User',
        targetId: id,
        detail: {
          name: dto.name,
          role: dto.role,
          passwordChanged: dto.password !== undefined,
        },
      },
    });

    return toSafeUser(updated);
  }

  /**
   * Delete an admin account. Rejects when:
   *   1. The caller is trying to delete themselves, or
   *   2. The target is the last SUPER_ADMIN (would lock out the platform).
   */
  async remove(id: number, adminId: number): Promise<void> {
    if (id === adminId) {
      throw new BadRequestException('不能删除当前登录的管理员账号');
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, studentId: true },
    });
    if (!target) {
      throw new NotFoundException('管理员不存在');
    }

    if (target.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('至少需要保留一位超级管理员');
      }
    }

    await this.prisma.user.delete({ where: { id } });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'delete_admin',
        targetType: 'User',
        targetId: id,
        detail: { studentId: target.studentId, role: target.role },
      },
    });
  }
}

/**
 * System settings service. Settings are stored as flat key/value rows in
 * SystemSetting (TEXT value). The API surface exposes them as a single
 * { key: value } map for both read and write.
 */
@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Return all settings as a { key: value } object. */
  async findAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  /** Upsert each key/value pair from the incoming map. */
  async update(
    values: Record<string, string>,
    adminId: number,
  ): Promise<Record<string, string>> {
    const entries = Object.entries(values);

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        }),
      ),
    );

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'update_settings',
        targetType: 'SystemSetting',
        targetId: 0,
        detail: { keys: entries.map(([k]) => k) },
      },
    });

    return this.findAll();
  }
}

/**
 * Admin audit log service. Returns paginated, filterable AdminLog rows with
 * the acting admin's name joined in for display.
 */
@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    query: AdminLogsQueryDto,
  ): Promise<Paginated<AdminLogWithAdmin>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: {
      adminId?: number;
      action?: { contains: string };
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (query.adminId !== undefined) where.adminId = query.adminId;
    if (query.action && query.action.trim() !== '') {
      where.action = { contains: query.action.trim() };
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      // endDate inclusive: add one day so the bound covers the whole day.
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt.lte = end;
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.adminLog.count({ where }),
      this.prisma.adminLog.findMany({
        where,
        include: { admin: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: AdminLogWithAdmin[] = rows.map((r) => ({
      id: r.id,
      adminId: r.adminId,
      adminName: r.admin.name,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      hasMore: page * pageSize < total,
      page,
      pageSize,
    };
  }
}
