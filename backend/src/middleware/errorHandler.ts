import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { sendError } from '../utils/apiResponse';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, 'A record with this value already exists', 409, 'DUPLICATE_ENTRY', env.isProduction ? undefined : err.meta);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 'Record not found', 404, 'NOT_FOUND');
      return;
    }
    sendError(res, 'Database request error', 400, 'DATABASE_ERROR', env.isProduction ? undefined : err.meta);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 'Invalid data provided to the database', 400, 'DATABASE_VALIDATION_ERROR');
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected error occurred';
  if (!env.isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  sendError(res, env.isProduction ? 'Internal server error' : message, 500, 'INTERNAL_ERROR');
}
