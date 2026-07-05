import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './app.config';

/**
 * Bootstrap the NestJS HTTP server.
 *
 * - Reads port from validated env config (default 3000).
 * - Enables CORS with origin: true in development so the mobile/admin
 *   frontends can talk to the API during local dev.
 * - Registers a global ValidationPipe with whitelist + transform so all
 *   inbound DTOs are automatically validated and stripped.
 * - Mounts every route under /api (e.g. /api/auth/login).
 */
async function bootstrap(): Promise<void> {
  const config = appConfig();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = config.port;
  await app.listen(port);
  logger.log(`Server listening on http://localhost:${port}/api`);
}

void bootstrap();
