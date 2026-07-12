import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/**
 * Batch-delete request body for POST /admin/podcasts/batch-delete. `ids` must
 * be a non-empty array of podcast IDs. The service hard-deletes each podcast
 * (cascades to PodcastTag, Comment, Favorite, PlayHistory, CollectionPodcast;
 * Like.podcastId and Notification.podcastId are SetNull) and writes a single
 * AdminLog entry. Missing IDs are silently skipped.
 */
export class AdminPodcastBatchDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  ids!: number[];
}
