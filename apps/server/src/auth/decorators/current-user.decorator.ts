import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * Parameter decorator that injects the authenticated user (req.user)
 * set by the JwtAuthGuard. Returns the whole user object by default,
 * or a single property when a key is supplied.
 *
 * @example
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * me(@CurrentUser() user: RequestUser) { ... }
 *
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * me(@CurrentUser('id') userId: number) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
