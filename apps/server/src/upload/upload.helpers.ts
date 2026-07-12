import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extname, join, relative } from 'path';
import { mkdirSync, promises as fsPromises } from 'fs';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

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
  'audio/mp4',
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

/**
 * Transcode an uploaded audio file to 320 kbps MP3 using ffmpeg.
 *
 * The MP3 is written to a temporary file first (to avoid read/write conflicts
 * when the source is already .mp3), then renamed to the final path. After a
 * successful transcode the source file is deleted so only the normalized MP3
 * remains on disk.
 *
 * Returns the absolute path, byte size, and duration (whole seconds) of the
 * resulting MP3.
 */
export async function transcodeToMp3(
  sourcePath: string,
): Promise<{ path: string; size: number; duration: number }> {
  const stem = extname(sourcePath)
    ? sourcePath.slice(0, -extname(sourcePath).length)
    : sourcePath;
  const mp3Path = `${stem}.mp3`;
  const tmpPath = `${stem}.tmp.${randomUUID()}.mp3`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', sourcePath,
    '-codec:a', 'libmp3lame',
    '-b:a', '320k',
    '-vn',
    tmpPath,
  ]);

  // Replace the source (or existing mp3) with the transcoded file.
  await fsPromises.rename(tmpPath, mp3Path);
  if (mp3Path !== sourcePath) {
    await fsPromises.unlink(sourcePath).catch(() => undefined);
  }

  const stat = await fsPromises.stat(mp3Path);
  const duration = await getAudioDuration(mp3Path);

  return { path: mp3Path, size: stat.size, duration };
}

/**
 * Read the duration (in whole seconds) of an audio file via ffprobe.
 * Returns 0 if ffprobe is unavailable or the duration can't be parsed.
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const dur = parseFloat(stdout.trim());
    return Number.isFinite(dur) && dur > 0 ? Math.floor(dur) : 0;
  } catch {
    return 0;
  }
}
