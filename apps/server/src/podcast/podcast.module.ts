import { Module } from '@nestjs/common';
import { PodcastController } from './podcast.controller';
import { PodcastService } from './podcast.service';
import { TranscriptService } from './transcript.service';
import { TagsModule } from '../tags/tags.module';

/**
 * Podcast feature module.
 *
 * PrismaModule and SystemModule are @Global, so they (and the JWT passport
 * strategy registered by AuthModule) are available without being imported
 * here. JwtAuthGuard / OptionalJwtAuthGuard rely on the 'jwt' strategy
 * registered globally via AuthModule (imported in AppModule).
 *
 * TagsModule is imported so PodcastService can resolve user-supplied new tag
 * names via TagsService.findOrCreate when creating/updating a podcast.
 */
@Module({
  imports: [TagsModule],
  controllers: [PodcastController],
  providers: [PodcastService, TranscriptService],
})
export class PodcastModule {}
