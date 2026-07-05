import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { MulterExceptionFilter } from './multer-exception.filter';
// PrismaModule + SystemModule are @Global, so they're available without import.

/**
 * Upload feature module.
 *
 * Wires the upload controller (cover + audio endpoints) and a global
 * multer exception filter that maps multer's LIMIT_FILE_SIZE to HTTP 413.
 *
 * JwtAuthGuard is applied on the controller; it relies on the 'jwt' passport
 * strategy registered by AuthModule (imported in AppModule), and JwtModule is
 * imported here for symmetry / explicit dependency.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [UploadController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
  ],
})
export class UploadModule {}
