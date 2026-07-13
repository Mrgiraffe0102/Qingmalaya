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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminPodcastsService, AdminCommentsService } from './admin-content.service';
import { AdminPodcastListDto, parseClassIds } from './dto/admin-podcast-list.dto';
import { AdminPodcastUpdateDto } from './dto/admin-podcast-update.dto';
import { AdminPodcastBatchTakedownDto } from './dto/admin-podcast-batch-takedown.dto';
import { AdminPodcastBatchPublishDto } from './dto/admin-podcast-batch-publish.dto';
import { AdminPodcastBatchTagDto } from './dto/admin-podcast-batch-tag.dto';
import { AdminPodcastBatchDeleteDto } from './dto/admin-podcast-batch-delete.dto';
import { AdminCommentListDto } from './dto/admin-comment-list.dto';
import { AdminCommentBatchDeleteDto } from './dto/admin-comment-batch-delete.dto';
import { AdminPodcastRejectDto } from './dto/admin-podcast-reject.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

/**
 * Admin podcast + comment management endpoints (Tasks 27 + 28).
 *
 * Two controllers are declared here, both guarded by JwtAuthGuard + RolesGuard
 * and restricted to OPERATOR / SUPER_ADMIN:
 *
 *   AdminPodcastsController  — /admin/podcasts
 *     GET    /                — paginated list (keyword + status filter)
 *     GET    /:id             — detail with author + tags + commentCount
 *     PUT    /:id             — edit metadata (title/description/coverPath/tagIds)
 *     PUT    /:id/takedown    — set status TAKEN_DOWN
 *     PUT    /:id/publish     — set status PUBLISHED + publishedAt = now
 *     DELETE /:id             — hard-delete single podcast
 *     POST   /batch-takedown  — bulk TAKEN_DOWN
 *     POST   /batch-publish   — bulk PUBLISHED (审核通过)
 *     POST   /batch-tag       — bulk add tags (merge, no replace)
 *     POST   /batch-delete    — bulk hard-delete
 *
 *   AdminCommentsController  — /admin/comments
 *     GET    /                — paginated list (podcastId/userId/keyword/date)
 *     DELETE /:id             — delete single comment
 *     POST   /batch-delete    — bulk delete
 *
 * Every mutation writes an AdminLog row (see AdminPodcastsService /
 * AdminCommentsService). The batch POST routes are declared before the `:id`
 * routes so the dynamic segment can't shadow them — though in practice NestJS
 * matches by method+path, declaring static paths first is the safe convention.
 */
@Controller('admin/podcasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminPodcastsController {
  constructor(private readonly podcasts: AdminPodcastsService) {}

  /** GET /admin/podcasts — paginated list with keyword + status filter. */
  @Get()
  list(@Query() dto: AdminPodcastListDto) {
    return this.podcasts.list(dto);
  }

  /**
   * POST /admin/podcasts/batch-takedown — bulk set status TAKEN_DOWN.
   * Declared before @Get(':id') / @Put(':id') so the static path wins; the
   * method differs too (POST) so there's no real collision.
   */
  @Post('batch-takedown')
  batchTakedown(
    @Body() dto: AdminPodcastBatchTakedownDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.batchTakedown(dto, adminId);
  }

  /** POST /admin/podcasts/batch-tag — bulk add tags (merge, no replace). */
  @Post('batch-tag')
  batchTag(
    @Body() dto: AdminPodcastBatchTagDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.batchTag(dto, adminId);
  }

  /** POST /admin/podcasts/batch-publish — bulk set status PUBLISHED (审核通过). */
  @Post('batch-publish')
  batchPublish(
    @Body() dto: AdminPodcastBatchPublishDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.batchPublish(dto, adminId);
  }

  /** POST /admin/podcasts/batch-delete — bulk hard-delete podcasts. */
  @Post('batch-delete')
  batchDelete(
    @Body() dto: AdminPodcastBatchDeleteDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.batchRemove(dto, adminId);
  }

  /** GET /admin/podcasts/options — lightweight id+title list for selectors.
   * Returns only PUBLISHED podcasts. Declared before @Get(':id') so the
   * static path wins.
   */
  @Get('options')
  options() {
    return this.podcasts.options();
  }

  /**
   * GET /admin/podcasts/flagged — list FLAGGED podcasts with flag reason +
   * reviewer info. Optionally filtered by classIds (teacher scope). Declared
   * before @Get(':id') so the static path wins.
   */
  @Get('flagged')
  flagged(@Query('classIds') classIds?: string) {
    const ids = parseClassIds(classIds);
    return this.podcasts.listFlagged(ids ?? undefined);
  }

  /** GET /admin/podcasts/:id — detail with author + tags + commentCount. */
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.podcasts.detail(id);
  }

  /** PUT /admin/podcasts/:id — edit metadata (title/description/coverPath/tagIds). */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminPodcastUpdateDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.update(id, dto, adminId);
  }

  /** PUT /admin/podcasts/:id/takedown — set status TAKEN_DOWN. */
  @Put(':id/takedown')
  takedown(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.takedown(id, adminId);
  }

  /** PUT /admin/podcasts/:id/publish — set status PUBLISHED + publishedAt = now. */
  @Put(':id/publish')
  publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.publish(id, adminId);
  }

  /**
   * PUT /admin/podcasts/:id/reject — reject a podcast with a reason. Sets
   * status TAKEN_DOWN, creates a PodcastReview (action=REJECT), notifies the
   * author with the reason. Used for both PENDING and FLAGGED podcasts.
   */
  @Put(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminPodcastRejectDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.podcasts.reject(id, dto, adminId);
  }

  /** DELETE /admin/podcasts/:id — hard-delete a single podcast. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ): Promise<void> {
    await this.podcasts.remove(id, adminId);
  }
}

@Controller('admin/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'SUPER_ADMIN')
export class AdminCommentsController {
  constructor(private readonly comments: AdminCommentsService) {}

  /**
   * GET /admin/comments — paginated list with filters: podcastId, userId,
   * keyword (matches content), date range. Each item includes the author
   * (UserSummary) and a lightweight podcast reference (id + title).
   */
  @Get()
  list(@Query() dto: AdminCommentListDto) {
    return this.comments.list(dto);
  }

  /**
   * POST /admin/comments/batch-delete — bulk delete. Declared before
   * @Delete(':id') so the static path wins.
   */
  @Post('batch-delete')
  batchDelete(
    @Body() dto: AdminCommentBatchDeleteDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.comments.batchDelete(dto.ids, adminId);
  }

  /**
   * GET /admin/comments/reported — list pending comment reports with reporter
   * + comment + author + podcast info. Optionally filtered by classIds
   * (teacher scope). Declared before @Delete(':id') so the static path wins.
   */
  @Get('reported')
  reported(@Query('classIds') classIds?: string) {
    const ids = parseClassIds(classIds);
    return this.comments.listReported(ids ?? undefined);
  }

  /** DELETE /admin/comments/:id — delete single comment. */
  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.comments.delete(id, adminId);
  }

  /**
   * PUT /admin/comments/:id/report/resolve — resolve a comment report. If
   * action='delete', the comment is deleted; if 'dismiss', the report is
   * marked resolved without modifying the comment.
   */
  @Put(':id/report/resolve')
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.comments.resolveReport(id, dto, adminId);
  }
}
