import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Wraps every error in the envelope boafie-web's lib/api/client.ts expects:
 * { success: false, error: { message, code? } }. `message` is passed
 * through as an array when class-validator produced one (ApiError on the
 * frontend joins arrays with ', ').
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        code = typeof b.error === 'string' ? (b.error as string) : undefined;
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({ success: false, error: { message, code } });
  }
}
