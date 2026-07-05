import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { extname, join, relative } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

/**
 * Upload helpers for the UploadModule.
 *
 * - UPLOAD_DIR is read once from env (set by ConfigModule.forRoot) and used
 *   as the disk root for multer.
 * - Files land at `{UPLOAD_DIR}/{yyyy}/{mm}/{uuid}.{ext}` so the static
 *   file tree stays browsable by date.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

/** Pure-abuse ceiling enforced by multer itself (real per-route limit is dynamic). */
export const SAFETY_FILE_SIZE_CEILING = 1024 * 1024 * 1024; // 1 GiB

export const COVER_MIME_WHITELIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const AUDIO_MIME_WHITELIST = [
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
] as const;

type MulterFile = Express.Multer.File;
type FileFilterCb = (error: Error | null, acceptFile: boolean) => void;

/**
 * Build a multer fileFilter that rejects anything outside `whitelist`.
 * Throws a BadRequestException (→ HTTP 400) so Nest's exception layer
 * maps it to a clean JSON error.
 */
export function makeMimeFilter(
  whitelist: readonly string[],
): (req: unknown, file: MulterFile, cb: FileFilterCb) => void {
  return (_req, file, cb) => {
    if (!whitelist.includes(file.mimetype)) {
      cb(new BadRequestException(`不支持的文件类型: ${file.mimetype}`), false);
      return;
    }
    cb(null, true);
  };
}

/**
 * diskStorage that drops files into {UPLOAD_DIR}/{yyyy}/{mm}/ and names them
 * with a uuid + original extension (falls back to a derived ext from mime).
 * Destination directories are created lazily per upload.
 */
export const multerDiskStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dir = join(UPLOAD_DIR, yyyy, mm);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname) || defaultExtForMime(file.mimetype);
    cb(null, `${randomUUID()}${ext}`);
  },
});

function defaultExtForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3';
    case 'audio/aac':
      return '.aac';
    case 'audio/wav':
      return '.wav';
    case 'audio/x-m4a':
    case 'audio/m4a':
      return '.m4a';
    default:
      return '';
  }
}

/**
 * Convert the absolute/relative on-disk path multer wrote to into the
 * portable relative path returned to clients and stored in the DB
 * (e.g. "2026/07/uuid.mp3"). Forward-slashes for URL safety.
 */
export function toRelativePath(diskPath: string): string {
  return relative(UPLOAD_DIR, diskPath).split('\\').join('/');
}
