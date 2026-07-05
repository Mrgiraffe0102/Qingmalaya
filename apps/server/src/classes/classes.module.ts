import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
// PrismaModule is @Global, no need to import here.

/**
 * Classes feature module. Read-only class reference data.
 */
@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
