import { Module } from '@nestjs/common';
import { PodcastController } from './podcast.controller';
import { PodcastService } from './podcast.service';

/**
 * Podcast feature module.
 *
 * PrismaModule and SystemModule are @Global, so they (and the JWT passport
 * strategy registered by AuthModule) are available without being imported
 * here. JwtAuthGuard / OptionalJwtAuthGuard rely on the 'jwt' strategy
 * registered globally via AuthModule (imported in AppModule).
 */
@Module({
  controllers: [PodcastController],
  providers: [PodcastService],
})
export class PodcastModule {}
