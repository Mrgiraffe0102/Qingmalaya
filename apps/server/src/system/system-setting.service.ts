import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read/write access to the SystemSetting table with a read-through
 * in-memory cache.
 *
 * Settings are stored as strings; numeric values are coerced by callers
 * (see getNumber / getMax* helpers). The cache is populated on first read
 * and refreshed on write; a single-process dev server doesn't need
 * cross-instance invalidation.
 *
 * Used by the upload module to fetch dynamic file-size limits
 * (`max_cover_size`, `max_audio_size`, `max_audio_duration`) so admins can
 * tune them at runtime without redeploying.
 */
@Injectable()
export class SystemSettingService {
  private readonly cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch a setting by key, returning defaultValue when the row is missing
   * or empty. Values are cached after the first DB hit.
   */
  async get(key: string, defaultValue: string): Promise<string> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as string;
    }

    const row = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    const value = row && row.value !== '' ? row.value : defaultValue;
    this.cache.set(key, value);
    return value;
  }

  /**
   * Convenience helper for numeric settings — parses the stored string and
   * falls back to defaultValue when absent/unparseable.
   */
  async getNumber(key: string, defaultValue: number): Promise<number> {
    const raw = await this.get(key, String(defaultValue));
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  /**
   * Upsert a setting value and refresh the in-memory cache.
   */
  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    this.cache.set(key, value);
  }

  /** Max cover image size in bytes (default 5 MiB). */
  getMaxCoverSize(): Promise<number> {
    return this.getNumber('max_cover_size', 5 * 1024 * 1024);
  }

  /** Max audio file size in bytes (default 200 MiB). */
  getMaxAudioSize(): Promise<number> {
    return this.getNumber('max_audio_size', 200 * 1024 * 1024);
  }

  /** Max audio duration in seconds (default 3600s = 60 min). */
  getMaxAudioDuration(): Promise<number> {
    return this.getNumber('max_audio_duration', 3600);
  }
}
