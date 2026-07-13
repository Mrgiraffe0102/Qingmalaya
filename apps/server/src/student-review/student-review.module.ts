import { Module } from '@nestjs/common';
import { StudentReviewController } from './student-review.controller';
import { StudentReviewService } from './student-review.service';

/**
 * Student review feature module. PrismaModule and NotificationsModule are
 * @Global, so their services are injectable here without explicit imports.
 * JwtAuthGuard works app-wide because the passport strategy is registered
 * globally by AuthModule.
 */
@Module({
  controllers: [StudentReviewController],
  providers: [StudentReviewService],
})
export class StudentReviewModule {}
