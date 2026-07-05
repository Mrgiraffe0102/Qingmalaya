import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth guard. Behaves like JwtAuthGuard when a valid Bearer token
 * is present (populates req.user), but never blocks the request — if the token
 * is missing or invalid, req.user is set to null and the handler runs as an
 * anonymous request.
 *
 * Use this on endpoints that should serve both authenticated and anonymous
 * callers (e.g. GET /podcasts, where liked/favorited flags are only attached
 * for logged-in users).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(_err: any, user: any): any {
    return user || null;
  }
}
