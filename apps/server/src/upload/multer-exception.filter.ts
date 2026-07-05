import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

/**
 * Translate multer's non-HttpException errors into clean HTTP responses.
 *
 * - `LIMIT_FILE_SIZE` → 413 Payload Too Large (matches the spec's "超限返回 413").
 * - any other MulterError → 400 Bad Request.
 *
 * HttpExceptions (e.g. BadRequestException thrown from the fileFilter or the
 * controller's dynamic size check) are left for Nest's default layer so they
 * keep their assigned status code.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter<MulterError> {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(exception: MulterError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    this.logger.warn(`multer error: ${exception.code} - ${exception.message}`);

    const http: HttpException =
      exception.code === 'LIMIT_FILE_SIZE'
        ? new PayloadTooLargeException('文件大小超出限制')
        : new BadRequestException(`上传失败: ${exception.message}`);

    const status = http.getStatus();
    res.status(status).json({
      statusCode: status,
      message: http.message,
      error: http.name,
    });
  }
}
