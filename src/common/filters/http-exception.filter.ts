import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { HTTP_STATUS_CODE_MAP } from "./http-exception.constants";
import { Response } from "express";

interface ExceptionBody {
  success?: boolean;
  message?: string | string[];
  [key: string]: unknown;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as string | ExceptionBody;

    // If service already threw a structured error object, pass it through
    if (
      typeof exceptionResponse === "object" &&
      exceptionResponse.success === false
    ) {
      return response.status(status).json(exceptionResponse);
    }

    // Handle class-validator errors
    if (
      typeof exceptionResponse === "object" &&
      Array.isArray(exceptionResponse.message)
    ) {
      return response.status(status).json({
        success: false,
        message: exceptionResponse.message[0],
        code: "VALIDATION_ERROR",
        errors: exceptionResponse.message,
      });
    }

    // Generic fallback
    response.status(status).json({
      success: false,
      message:
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse.message ?? "An error occurred"),
      code: this.statusToCode(status),
    });
  }

  private statusToCode(status: number): string {
    return HTTP_STATUS_CODE_MAP[status] ?? "UNKNOWN_ERROR";
  }
}
