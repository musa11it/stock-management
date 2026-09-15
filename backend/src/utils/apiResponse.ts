import { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200, meta?: Meta): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendError(res: Response, message: string, statusCode = 500, error = 'INTERNAL_ERROR', details?: unknown): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
    ...(details ? { details } : {}),
  });
}
