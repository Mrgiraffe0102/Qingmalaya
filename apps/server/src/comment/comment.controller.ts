import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CommentWithUser, Paginated } from '@qingmalaya/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/**
 * Comment HTTP endpoints.
 *
 * Routes span two prefixes (podcast-scoped vs comment-scoped), so the
 * controller declares no base path and each handler lists its full path.
 * Every route requires an authenticated user — `liked` flags and ownership
 * checks both depend on the current user id from the JWT.
 *
 * - GET    /podcasts/:id/comments  — paginated list with nested replies.
 * - POST   /podcasts/:id/comments  — create a comment or reply.
 * - DELETE /comments/:id           — delete (author or OPERATOR+).
 * - POST   /comments/:id/like      — like a comment (idempotent).
 * - DELETE /comments/:id/like      — unlike a comment (idempotent).
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  /**
   * GET /podcasts/:id/comments?page=&pageSize=
   *
   * Returns visible top-level comments with one level of visible replies.
   * `total` counts only top-level visible comments. `page` defaults to 1,
   * `pageSize` to 20 (clamped to 100).
   */
  @Get('podcasts/:id/comments')
  list(
    @Param('id', ParseIntPipe) podcastId: number,
    @CurrentUser('id') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<Paginated<CommentWithUser>> {
    return this.comments.listComments(
      podcastId,
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  /**
   * POST /podcasts/:id/comments
   *
   * Create a comment. Body: { content, parentId? }. The service validates the
   * podcast is PUBLISHED and (for replies) that the parent is a top-level
   * comment on the same podcast.
   */
  @Post('podcasts/:id/comments')
  create(
    @Param('id', ParseIntPipe) podcastId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentWithUser> {
    return this.comments.createComment(podcastId, userId, dto);
  }

  /**
   * DELETE /comments/:id
   *
   * Delete a comment. Author or OPERATOR+. If the comment has replies it is
   * soft-hidden (so replies stay); otherwise hard-deleted. Returns 204 on
   * success.
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ): Promise<{ success: true }> {
    return this.comments.deleteComment(commentId, userId, role);
  }

  /**
   * POST /comments/:id/like — idempotent like. Returns { liked, likeCount }.
   */
  @Post('comments/:id/like')
  like(
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser('id') userId: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    return this.comments.likeComment(commentId, userId);
  }

  /**
   * DELETE /comments/:id/like — idempotent unlike. Returns { liked, likeCount }.
   */
  @Delete('comments/:id/like')
  unlike(
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser('id') userId: number,
  ): Promise<{ liked: boolean; likeCount: number }> {
    return this.comments.unlikeComment(commentId, userId);
  }
}
