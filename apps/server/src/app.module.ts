import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { SystemModule } from './system/system.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { TagsModule } from './tags/tags.module';
import { BannersModule } from './banners/banners.module';
import { CommentModule } from './comment/comment.module';
import { PodcastModule } from './podcast/podcast.module';
import { CollectionsModule } from './collections/collections.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { StudentReviewModule } from './student-review/student-review.module';
import { AppReleaseModule } from './app-release/app-release.module';
import { PopupModule } from './popup/popup.module';
import { appConfig } from './app.config';

/**
 * Root application module.
 *
 * Wires the global Config/Prisma/System modules plus the Auth and Upload
 * feature modules, and exposes the on-disk uploads directory under /static
 * (index disabled so only real files are served).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    SystemModule,
    AuthModule,
    UploadModule,
    UsersModule,
    ClassesModule,
    TagsModule,
    BannersModule,
    CommentModule,
    PodcastModule,
    CollectionsModule,
    AdminModule,
    NotificationsModule,
    ActivityLogModule,
    StudentReviewModule,
    AppReleaseModule,
    PopupModule,
    ServeStaticModule.forRoot({
      rootPath: resolve(appConfig().upload.dir),
      serveRoot: '/static',
      serveStaticOptions: { index: false },
    }),
  ],
})
export class AppModule {}
