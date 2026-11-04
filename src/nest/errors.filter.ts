import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { logger } from "../logger";

/**
 * MKB-045: an unexpected API error (not a 4xx the controller threw on purpose) goes to our logger,
 * so it lands in the log file and reaches the admin as an alert. The response stays Nest's default 500.
 */
@Catch()
export class LogUnexpectedErrorsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException)) {
      const req = host.switchToHttp().getRequest<{ method: string; route?: { path?: string } }>();
      const reason = exception instanceof Error ? exception.message : String(exception);
      logger.error(`API ${req.method} ${req.route?.path ?? "?"} failed: ${reason}`);
    }
    super.catch(exception, host);
  }
}
