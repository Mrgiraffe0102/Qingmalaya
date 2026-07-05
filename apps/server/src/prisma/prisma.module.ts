import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global Prisma module.
 *
 * Exposes PrismaService app-wide so feature modules don't need to import
 * PrismaModule explicitly in their imports arrays.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
