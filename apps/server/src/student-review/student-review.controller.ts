import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentReviewService } from './student-review.service';
import { StudentReviewActionDto } from './dto/student-review-action.dto';

/**
 * Student admin review endpoints.
 *
 * All routes require authentication (JwtAuthGuard). The service internally
 * checks `isStudentAdmin` and returns 403 for non-admins — no @Roles decorator
 * is needed because student admins keep the STUDENT role.
 *
 * - GET  /student-review/assignment     — review range + summary for this admin
 * - GET  /student-review/queue          — PENDING podcasts assigned to review
 * - POST /student-review/:podcastId/review — submit approve/flag/reject
 */
@Controller('student-review')
@UseGuards(JwtAuthGuard)
export class StudentReviewController {
  constructor(private readonly reviewService: StudentReviewService) {}

  /** GET /student-review/assignment — compute and return the review assignment. */
  @Get('assignment')
  getAssignment(@CurrentUser('id') userId: number) {
    return this.reviewService.getAssignment(userId);
  }

  /** GET /student-review/queue — list PENDING podcasts to review. */
  @Get('queue')
  getQueue(@CurrentUser('id') userId: number) {
    return this.reviewService.getQueue(userId);
  }

  /** POST /student-review/:podcastId/review — submit a review action. */
  @Post(':podcastId/review')
  submitReview(
    @Param('podcastId', ParseIntPipe) podcastId: number,
    @Body() dto: StudentReviewActionDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.reviewService.review(podcastId, dto, userId);
  }
}
