import { Module } from '@nestjs/common';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';
// PrismaModule is @Global, no need to import here.

/**
 * Banners feature module. Read-only discovery carousel items.
 */
@Module({
  controllers: [BannersController],
  providers: [BannersService],
})
export class BannersModule {}
