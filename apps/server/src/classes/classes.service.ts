import { Injectable, NotFoundException } from '@nestjs/common';
import type { Class } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Convert a Prisma Class row to the shared Class contract (dates → ISO strings).
 */
function toClass(cls: {
  id: number;
  name: string;
  grade: string | null;
  createdAt: Date;
}): Class {
  return {
    id: cls.id,
    name: cls.name,
    grade: cls.grade ?? '',
    createdAt: cls.createdAt.toISOString(),
  };
}

/**
 * Class domain service. Read-only class reference data used by the browse
 * page's class dropdown filter.
 */
@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All classes ordered by id asc.
   */
  async findAll(): Promise<Class[]> {
    const classes = await this.prisma.class.findMany({
      orderBy: { id: 'asc' },
    });
    return classes.map(toClass);
  }

  /**
   * Single class by id. 404 if not found.
   */
  async findOne(id: number): Promise<Class> {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new NotFoundException('班级不存在');
    }
    return toClass(cls);
  }
}
