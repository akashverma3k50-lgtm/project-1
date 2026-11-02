import type { Request, Response, NextFunction } from 'express';
import { generateCsrfToken, verifyCsrfToken } from '../utils/csrf.js';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

export const CSRF_COOKIE_NAME = config.isProduction ? '__Host-csrf' : '_csrf';

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Retrieve token from cookie or generate a new one
  let token = req.cookies?.[CSRF_COOKIE_NAME];

  if (!token || !verifyCsrfToken(token)) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Accessible by frontend JS for AJAX headers, or readable via double-submit
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600000 * 24, // 24 hours
    });
  }

  // Attach token to locals for server-side rendered forms
  res.locals.csrfToken = token;

  // Safe HTTP methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Check token in custom header or body
  const requestToken =
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    req.body?._csrf ||
    req.body?.csrfToken;

  if (!requestToken || typeof requestToken !== 'string') {
    logger.warn({ ip: req.ip, path: req.path }, 'CSRF token missing on mutating request');
    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed: Missing token',
    });
    return;
  }

  // Verify HMAC validity and match with session cookie
  if (!verifyCsrfToken(requestToken) || requestToken !== token) {
    logger.warn({ ip: req.ip, path: req.path }, 'CSRF token mismatch or forgery attempt detected');
    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed: Invalid or expired token',
    });
    return;
  }

  next();
}
