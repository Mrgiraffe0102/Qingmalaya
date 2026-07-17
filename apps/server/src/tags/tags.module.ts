import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
// PrismaModule is @Global, no need to import here.

/**
 * Tags feature module. Read-only tag reference data for the upload page.
 */
@Module({
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
