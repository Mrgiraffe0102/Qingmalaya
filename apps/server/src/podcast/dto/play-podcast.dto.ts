import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Play-tracking request body for POST /podcasts/:id/play. `position` is the
 * current playback offset in seconds; defaults to 0 when omitted.
 */
export class PlayPodcastDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  position?: number;
}
