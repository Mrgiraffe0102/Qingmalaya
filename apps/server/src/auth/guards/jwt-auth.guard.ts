import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Default JWT auth guard. Apply per-controller (or per-handler) via
 * @UseGuards(JwtAuthGuard). Routes without this guard are public.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
