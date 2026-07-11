import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Play-tracking request body for POST /podcasts/:id/play. `position` is the
 * current playback offset in seconds; defaults to 0 when omitted. `start`
 * is true when the user just clicked into the podcast to begin a new play
 * session (as opposed to a periodic progress report) — only then are
 * playCount and totalListens incremented.
 */
export class PlayPodcastDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  position?: number;

  @IsBoolean()
  @IsOptional()
  start?: boolean;
}
