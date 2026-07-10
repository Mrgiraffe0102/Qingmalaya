import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Banner HTTP endpoints.
 *
 * - GET /banners — active ONLINE banners within their time window.
 * - GET /banners/:id — single banner with markdownContent (for MARKDOWN type).
 */
@Controller('banners')
@UseGuards(JwtAuthGuard)
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  findActive() {
    return this.banners.findActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.banners.findOne(id);
  }
}
