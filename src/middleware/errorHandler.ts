import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

export function notFoundHandler(req: Request, res: Response): void {
  const acceptsHtml = req.accepts('html');
  if (acceptsHtml) {
    res.status(404).render('404', {
      title: '404 - Page Not Found',
      path: req.path,
    });
    return;
  }

  res.status(404).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Resource Not Found',
    status: 404,
    detail: `The requested path ${req.path} was not found on this server.`,
    instance: req.originalUrl,
  });
}

export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.status || err.statusCode || 500;

  logger.error(
    {
      err: {
        message: err.message,
        stack: config.isProduction ? undefined : err.stack,
      },
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    },
    'Unhandled request error',
  );

  const acceptsHtml = req.accepts('html');
  if (acceptsHtml && statusCode === 500) {
    res.status(500).render('500', {
      title: '500 - Server Error',
      message: config.isProduction
        ? 'An unexpected error occurred. Our team has been notified.'
        : err.message,
    });
    return;
  }

  res.status(statusCode).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: statusCode >= 500 ? 'Internal Server Error' : 'Client Error',
    status: statusCode,
    detail: config.isProduction && statusCode >= 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
    instance: req.originalUrl,
  });
}
