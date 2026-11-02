import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { contactFormSchema } from '../utils/sanitizer.js';
import { saveContactSubmission, recordAnalyticsEvent, checkDatabaseHealth, getDatabase } from '../database/db.js';
import { sendContactNotification } from '../services/emailService.js';
import { getSiteContent } from '../services/contentService.js';
import { createRateLimiter, antiBotProtection } from '../middleware/security.js';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

export const apiRouter = Router();

// Dedicated rate limiter for contact form submissions (5 submissions per 15 minutes per IP)
const contactLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.contactMax,
  message: 'Too many contact inquiries from this IP. Please wait a few minutes before trying again.',
});

/**
 * POST /api/contact
 * Handles contact form submissions with validation, anti-bot, rate limiting, and parameterized SQL storage
 */
apiRouter.post(
  '/contact',
  contactLimiter,
  antiBotProtection,
  async (req: Request, res: Response) => {
    try {
      const parsed = contactFormSchema.parse(req.body);
      const content = getSiteContent();

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Store in SQLite database using strictly parameterized queries
      const insertId = saveContactSubmission({
        name: parsed.name,
        email: parsed.email,
        subject: parsed.subject,
        message: parsed.message,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      logger.info({ inquiryId: insertId, email: parsed.email }, 'Contact submission received and saved');

      // Send email alert asynchronously without blocking client response
      sendContactNotification(parsed).catch((err) => {
        logger.error({ err }, 'Background email notification failed');
      });

      res.status(200).json({
        success: true,
        message: content.contact.form.successMessage,
        id: insertId,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues;
        const errors = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          success: false,
          message: 'Validation failed for one or more fields',
          errors,
        });
        return;
      }

      logger.error({ err }, 'Error processing contact form submission');
      res.status(500).json({
        success: false,
        message: 'Internal server error while processing your submission',
      });
    }
  },
);

/**
 * GET /api/csrf-token
 * Provides client with a valid CSRF token
 */
apiRouter.get('/csrf-token', (_req: Request, res: Response) => {
  res.json({
    csrfToken: res.locals.csrfToken,
  });
});

/**
 * POST /api/analytics
 * Lightweight on-page privacy-preserving analytics ping
 */
apiRouter.post('/analytics', (req: Request, res: Response) => {
  try {
    const { event_type = 'pageview', path = '/', referrer = '' } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Privacy protection: one-way hash IP with salt to avoid storing raw PII
    const ipHash = crypto.createHash('sha256').update(`${ip}-${new Date().toDateString()}`).digest('hex').substring(0, 16);

    recordAnalyticsEvent(
      String(event_type).slice(0, 50),
      String(path).slice(0, 200),
      String(referrer).slice(0, 200),
      ipHash,
    );

    res.json({ success: true });
  } catch (err) {
    logger.warn({ err }, 'Analytics event recording failed');
    res.status(200).json({ success: false }); // Always respond 200 to not break client
  }
});

/**
 * Restrict internal diagnostics/telemetry to local loopback or authorized secret token
 * Public users receive a 404 Not Found to conceal internal infrastructure details
 */
function requireInternalAccess(req: Request, res: Response, next: () => void): void {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLoopback =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost';

  const providedKey =
    req.headers['x-monitoring-key'] ||
    req.query.key;

  const isAuthorized = providedKey === config.internalMonitoringKey;

  // In test / localhost or if authorized with internal key, allow access
  if (isLoopback || isAuthorized) {
    return next();
  }

  logger.warn({ ip, path: req.path }, 'Unauthorized external attempt to access private internal probe');
  res.status(404).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Resource Not Found',
    status: 404,
    detail: `The requested path ${req.path} was not found on this server.`,
  });
}

/**
 * GET /health
 * Private uptime and infrastructure probe for Docker / Kubernetes / Ops
 */
apiRouter.get('/health', requireInternalAccess, (_req: Request, res: Response) => {
  const dbHealth = checkDatabaseHealth();
  const memory = process.memoryUsage();

  const healthData = {
    status: dbHealth.ok ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbHealth.ok ? 'CONNECTED' : 'UNAVAILABLE',
      latencyMs: dbHealth.latencyMs,
    },
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
    environment: config.env,
    nodeVersion: process.version,
  };

  const statusCode = dbHealth.ok ? 200 : 503;
  res.status(statusCode).json(healthData);
});

/**
 * GET /metrics
 * Private operational telemetry metrics
 */
apiRouter.get('/metrics', requireInternalAccess, (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const contactCount = (db.prepare('SELECT COUNT(*) as count FROM contact_submissions').get() as { count: number }).count;
    const analyticsCount = (db.prepare('SELECT COUNT(*) as count FROM analytics_events').get() as { count: number }).count;

    res.json({
      processUptimeSeconds: Math.floor(process.uptime()),
      totalContactSubmissions: contactCount,
      totalAnalyticsEvents: analyticsCount,
      cpuUsage: process.cpuUsage(),
    });
  } catch (err) {
    logger.error({ err }, 'Metrics generation failed');
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});
