import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
// PrismaModule is @Global, no need to import here.

/**
 * Users feature module. Self-service profile, play history, and favorites
 * for the authenticated user.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
