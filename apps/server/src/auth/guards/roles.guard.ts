import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

/**
 * Role-based authorization guard. Reads the @Roles() metadata set on the
 * handler (falling back to the class), then checks req.user.role against
 * the allowed roles. Throws ForbiddenException if the user's role is not
 * permitted. Must be registered AFTER JwtAuthGuard so req.user is set.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() metadata => no role restriction.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const userRole = request.user?.role;
    // TEACHER has the same permissions as OPERATOR
    const effectiveRole = userRole === 'TEACHER' ? 'OPERATOR' : userRole;

    if (!effectiveRole || !requiredRoles.includes(effectiveRole as Role)) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
