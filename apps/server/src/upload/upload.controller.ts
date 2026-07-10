import {
  BadRequestException,
  Controller,
  Post,
  PayloadTooLargeException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { promises as fsPromises } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemSettingService } from '../system/system-setting.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIO_MIME_WHITELIST,
  COVER_MIME_WHITELIST,
  SAFETY_FILE_SIZE_CEILING,
  makeMimeFilter,
  multerDiskStorage,
  toRelativePath,
} from './upload.helpers';

/** Standard upload response returned to the client and stored in the DB. */
export interface UploadResult {
  path: string;
  size: number;
  mimetype: string;
}

/** Image upload response — includes the UploadedFile DB record id. */
export interface ImageUploadResult extends UploadResult {
  id: number;
  filename: string;
  originalName: string;
}

/**
 * File-upload endpoints.
 *
 * Both routes require an authenticated user (any role — STUDENT is the floor).
 * The per-route size cap is read from SystemSetting on each request so admins
 * can tune it at runtime; a high multer ceiling is just an abuse safety net.
 *
 * Files are written via multer diskStorage into {UPLOAD_DIR}/{yyyy}/{mm}/ and
 * the relative path is returned for the client to reference later.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly settings: SystemSettingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /upload/cover — accept a podcast cover image (jpeg/png/webp).
   * Size limit comes from SystemSetting `max_cover_size` (default 5 MiB).
   */
  @Post('cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      fileFilter: makeMimeFilter(COVER_MIME_WHITELIST),
      limits: { fileSize: SAFETY_FILE_SIZE_CEILING },
    }),
  )
  async uploadCover(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    return this.handleUpload(file, 'max_cover_size', 5 * 1024 * 1024);
  }

  /**
   * POST /upload/audio — accept a podcast audio track (mpeg/mp3/aac/wav/m4a).
   * Size limit comes from SystemSetting `max_audio_size` (default 200 MiB).
   */
  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      fileFilter: makeMimeFilter(AUDIO_MIME_WHITELIST),
      limits: { fileSize: SAFETY_FILE_SIZE_CEILING },
    }),
  )
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResult> {
    return this.handleUpload(file, 'max_audio_size', 200 * 1024 * 1024);
  }

  /**
   * POST /upload/image — accept a generic image (jpeg/png/webp) for Banner
   * backgrounds, Markdown inline images, Collection covers, etc. Creates an
   * UploadedFile record so the image appears in the admin image library.
   * Size limit comes from SystemSetting `max_cover_size` (default 5 MiB).
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      fileFilter: makeMimeFilter(COVER_MIME_WHITELIST),
      limits: { fileSize: SAFETY_FILE_SIZE_CEILING },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ImageUploadResult> {
    const result = await this.handleUpload(
      file,
      'max_cover_size',
      5 * 1024 * 1024,
    );
    const record = await this.prisma.uploadedFile.create({
      data: {
        filename: file!.filename,
        originalName: file!.originalname,
        path: result.path,
        mimetype: result.mimetype,
        size: result.size,
      },
    });
    return {
      id: record.id,
      filename: record.filename,
      originalName: record.originalName,
      path: result.path,
      size: result.size,
      mimetype: result.mimetype,
    };
  }

  /**
   * Shared post-upload handling: validate presence, enforce the dynamic size
   * limit (deleting the just-written file on violation), and return the
   * portable relative path.
   */
  private async handleUpload(
    file: Express.Multer.File | undefined,
    settingKey: string,
    defaultLimit: number,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    const limit = await this.settings.getNumber(settingKey, defaultLimit);
    if (file.size > limit) {
      // Clean up the oversized file we just wrote to disk.
      await fsPromises.unlink(file.path).catch(() => undefined);
      throw new PayloadTooLargeException(
        `文件大小超出限制 (上限 ${Math.floor(limit / 1024 / 1024)} MiB)`,
      );
    }

    return {
      path: toRelativePath(file.path),
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
