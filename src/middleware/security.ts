import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

/**
 * Enforce HTTPS Redirection in production environments
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  // If in production and request protocol is not https, issue 301 Permanent Redirect
  if (config.isProduction) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      const host = req.headers.host || `localhost:${config.port}`;
      const secureUrl = `https://${host}${req.url}`;
      logger.info({ redirect: secureUrl }, 'Redirecting HTTP request to HTTPS');
      res.redirect(301, secureUrl);
      return;
    }
  }
  next();
}

/**
 * Configure comprehensive HTTP security headers via Helmet
 */
export const configureSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"], // Same effect as X-Frame-Options: DENY in modern browsers
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true,
  strictTransportSecurity: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
});

/**
 * Permissions-Policy header configuration
 */
export function setPermissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()',
  );
  next();
}

/**
 * In-memory sliding window rate limiter
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + options.windowMs) / 1000));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, options.maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > options.maxRequests) {
      logger.warn({ ip, path: req.path }, 'Rate limit exceeded');
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests, please try again later.',
        retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Anti-Bot Honeypot and Submission Velocity Validation
 */
export function antiBotProtection(req: Request, res: Response, next: NextFunction): void {
  const { website_url_hp, form_timestamp } = req.body || {};

  // 1. Honeypot check: If a bot filled out the hidden field, drop silently or return 400
  if (website_url_hp && typeof website_url_hp === 'string' && website_url_hp.trim() !== '') {
    logger.warn({ ip: req.ip }, 'Spam bot detected: Honeypot field filled');
    // Emulate success or reject so bots waste cycles without knowing they were caught
    res.status(400).json({
      success: false,
      message: 'Automated submission detected',
    });
    return;
  }

  // 2. Timing check: If submitted faster than 1.5 seconds, it's automated script
  if (form_timestamp && typeof form_timestamp === 'number') {
    const elapsedMs = Date.now() - form_timestamp;
    if (elapsedMs < 1500) {
      logger.warn({ ip: req.ip, elapsedMs }, 'Spam bot detected: Form submitted abnormally fast');
      res.status(400).json({
        success: false,
        message: 'Submission too fast. Please verify you are human.',
      });
      return;
    }
  }

  next();
}
