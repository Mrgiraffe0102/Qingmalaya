import { SetMetadata } from '@nestjs/common';

/**
 * Role string-literal union. Mirrors `@qingmalaya/shared`'s `Role` enum so
 * this decorator stays runtime-safe without pulling the shared package's
 * source into the server's `rootDir` (which would break tsc --noEmit).
 */
export type Role = 'STUDENT' | 'TEACHER' | 'OPERATOR' | 'SUPER_ADMIN';

/**
 * Metadata key under which allowed roles are stored for RolesGuard.
 */
export const ROLES_KEY = 'ROLES_KEY';

/**
 * Mark a handler/class as requiring one of the given roles.
 *
 * @example
 * @Roles('OPERATOR', 'SUPER_ADMIN')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
