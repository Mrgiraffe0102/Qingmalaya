import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wrapped as a NestJS injectable.
 *
 * Connects lazily on module init and disconnects gracefully on shutdown.
 * Registered as a @Global provider by PrismaModule so feature modules
 * (Auth, Upload, Podcast, etc.) can inject it directly.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
