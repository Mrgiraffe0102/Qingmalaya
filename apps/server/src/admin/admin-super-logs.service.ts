import { Injectable } from '@nestjs/common';
import { Prisma, UserAction } from '@prisma/client';
import type { Paginated, UserActivityLogWithUser } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSuperLogsQueryDto } from './dto/admin-super-logs-query.dto';

/**
 * Admin super-log service. Returns paginated, filterable UserActivityLog rows
 * with the acting user's name/studentId/role joined in for display.
 * SUPER_ADMIN only.
 */
@Injectable()
export class AdminSuperLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    query: AdminSuperLogsQueryDto,
  ): Promise<Paginated<UserActivityLogWithUser>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserActivityLogWhereInput = {};
    if (query.userId !== undefined) where.userId = query.userId;
    if (query.action && query.action.trim() !== '') {
      where.action = query.action.trim() as UserAction;
    }
    if (query.targetType && query.targetType.trim() !== '') {
      where.targetType = query.targetType.trim();
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt.lte = end;
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.userActivityLog.count({ where }),
      this.prisma.userActivityLog.findMany({
        where,
        include: {
          user: {
            select: { name: true, studentId: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: UserActivityLogWithUser[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      action: r.action as UserActivityLogWithUser['action'],
      targetType: r.targetType,
      targetId: r.targetId,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name,
      studentId: r.user.studentId,
      role: r.user.role as UserActivityLogWithUser['role'],
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
