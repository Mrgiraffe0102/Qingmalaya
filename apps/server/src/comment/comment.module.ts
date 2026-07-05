import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
// PrismaModule is @Global, so PrismaService is injectable here without import.
// The 'jwt' passport strategy is registered app-wide by AuthModule, so
// JwtAuthGuard works without importing AuthModule/JwtModule here.

/**
 * Comment feature module. Wires the comment controller (list/create/delete +
 * like/unlike) and the comment service. All routes require auth (enforced via
 * JwtAuthGuard on the controller).
 */
@Module({
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
