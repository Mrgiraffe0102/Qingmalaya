import { Controller, Get, UseGuards } from '@nestjs/common';
import { BannersService } from './banners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Banner HTTP endpoints.
 *
 * - GET /banners — active ONLINE banners within their time window.
 */
@Controller('banners')
@UseGuards(JwtAuthGuard)
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  findActive() {
    return this.banners.findActive();
  }
}
