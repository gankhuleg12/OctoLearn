import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Errors thrown on purpose. `code` is a stable machine-readable id for clients;
 * `message` is user-facing Mongolian text that apps may show as-is.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Нэвтрэх шаардлагатай.') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Хандах эрхгүй.') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Олдсонгүй.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);
export const locked = (message = 'Өмнөх хичээлээ эхлээд дуусгана уу.') => new HttpError(423, 'LOCKED', message);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Оруулсан мэдээлэл буруу байна.', details: err.issues },
    });
    return;
  }
  // express.json() parse failures
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON буруу байна.' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Серверийн алдаа гарлаа.' } });
};
