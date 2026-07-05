import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { User, LoginResponse, RefreshResponse } from '@qingmalaya/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

/**
 * Prisma user row including passwordHash — internal only.
 */
type UserWithPassword = Awaited<
  ReturnType<PrismaService['user']['findUnique']>
>;

/**
 * Strip passwordHash (and any non-shared fields) before returning a user
 * over the wire. Converts Date fields to ISO strings to match the shared
 * `User` type contract.
 */
function toSafeUser(user: NonNullable<UserWithPassword>): User {
  const { passwordHash: _omit, ...rest } = user;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  } as User;
}

/**
 * Auth domain service. Handles login (with bcrypt password verification),
 * password change, JWT refresh, and the current-user lookup.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticate by studentId + password and issue access + refresh JWTs.
   * Throws UnauthorizedException on unknown user, banned user, or bad password.
   * On first successful login, flips firstLogin to false.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { studentId: dto.studentId },
    });

    if (!user) {
      throw new UnauthorizedException('学号或密码错误');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('账号已被封禁');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('学号或密码错误');
    }

    // First successful login — clear the firstLogin flag.
    if (user.firstLogin) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { firstLogin: false },
      });
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

  /**
   * Change a user's password. Verifies the old password, hashes the new one
   * with bcrypt (cost 10), and clears mustChangePassword + firstLogin.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('旧密码错误');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        firstLogin: false,
      },
    });

    return { success: true };
  }

  /**
   * Verify a refresh token and mint fresh access + refresh JWTs.
   * Throws UnauthorizedException if the token is invalid/expired.
   */
  async refresh(refreshToken: string): Promise<RefreshResponse> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      const tokenPayload: JwtPayload = { sub: payload.sub, role: payload.role };

      const newAccessToken = await this.jwt.signAsync(tokenPayload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL'),
      });
      const newRefreshToken = await this.jwt.signAsync(tokenPayload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL'),
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  /**
   * Return the current user's profile, omitting the password hash.
   */
  async me(userId: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return toSafeUser(user);
  }
}
