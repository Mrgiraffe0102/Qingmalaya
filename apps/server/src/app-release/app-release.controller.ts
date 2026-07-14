import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  multerDiskStorage,
  toRelativePath,
} from '../upload/upload.helpers';
import { AppReleaseService } from './app-release.service';
import { CreateReleaseDto } from './dto/create-release.dto';

/** MIME types accepted for APK uploads. */
const APK_MIME_WHITELIST = [
  'application/vnd.android.package-archive',
  'application/octet-stream',
] as const;

/**
 * App release management endpoints.
 *
 * Admin (SUPER_ADMIN):
 *   POST   /admin/releases           — create a release (version + content + optional apkPath)
 *   POST   /admin/releases/upload-apk — upload APK file, returns relative path
 *   GET    /admin/releases           — list all releases
 *   DELETE /admin/releases/:id       — delete a release + its APK file
 *
 * Public:
 *   GET    /releases/latest          — get the latest release
 */
@Controller()
export class AppReleaseController {
  constructor(private readonly releases: AppReleaseService) {}

  // --- Admin endpoints ---

  @Post('admin/releases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateReleaseDto) {
    return this.releases.create(dto);
  }

  @Post('admin/releases/upload-apk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      fileFilter: (_req, file, cb) => {
        if (!APK_MIME_WHITELIST.includes(file.mimetype as never)) {
          cb(
            new BadRequestException(
              `不支持的文件类型: ${file.mimetype}，请上传 .apk 文件`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB APK ceiling
    }),
  )
  async uploadApk(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ path: string; size: number; originalName: string }> {
    if (!file) {
      throw new BadRequestException('请上传 APK 文件');
    }
    return {
      path: toRelativePath(file.path),
      size: file.size,
      originalName: file.originalname,
    };
  }

  @Get('admin/releases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async findAll() {
    return this.releases.findAll();
  }

  @Delete('admin/releases/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.releases.remove(id);
  }

  // --- Public endpoint ---

  @Get('releases/latest')
  async findLatest() {
    return this.releases.findLatest();
  }
}
