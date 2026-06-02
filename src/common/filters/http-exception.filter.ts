import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    // If service already threw a structured error object, pass it through
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse.success === false
    ) {
      return response.status(status).json(exceptionResponse);
    }

    // Handle class-validator errors
    if (
      typeof exceptionResponse === 'object' &&
      Array.isArray(exceptionResponse.message)
    ) {
      return response.status(status).json({
        success: false,
        message: exceptionResponse.message[0],
        code: 'VALIDATION_ERROR',
        errors: exceptionResponse.message,
      });
    }

    // Generic fallback
    response.status(status).json({
      success: false,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse.message ?? 'An error occurred',
      code: this.statusToCode(status),
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}
