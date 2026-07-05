import { Body, Controller, Post } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

/**
 * Admin authentication endpoints (public — no JWT required to log in).
 *
 * - POST /admin/auth/login — validates OPERATOR/SUPER_ADMIN credentials and
 *   issues access + refresh JWTs. The frontend stores the token + role and
 *   uses them for all subsequent /admin/* requests.
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto);
  }
}
