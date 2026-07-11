import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { User, LoginResponse } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

type UserWithPassword = Awaited<
  ReturnType<PrismaService['user']['findUnique']>
>;

function toSafeUser(user: NonNullable<UserWithPassword>): User {
  const { passwordHash: _omit, ...rest } = user;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  } as User;
}

/**
 * Admin authentication service. Validates that the caller has OPERATOR or
 * SUPER_ADMIN role before issuing JWTs — student/teacher accounts are rejected
 * even with correct credentials.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { studentId: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.role !== 'OPERATOR' && user.role !== 'TEACHER' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('无管理员权限');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('账号已被封禁');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL'),
    });

    return {
      accessToken,
      refreshToken,
      user: toSafeUser(user),
      mustChangePassword: user.mustChangePassword,
    };
  }
}
