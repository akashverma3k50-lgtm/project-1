import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { httpLogger } from './logger/index.js';
import {
  enforceHttps,
  configureSecurityHeaders,
  setPermissionsPolicy,
} from './middleware/security.js';
import { csrfProtection } from './middleware/csrf.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { pagesRouter } from './routes/pages.js';
import { apiRouter } from './routes/api.js';

export function createApp(): express.Application {
  const app = express();

  // Enable proxy trust for reverse proxies (Nginx / Cloudflare / Load Balancers)
  app.set('trust proxy', 1);

  // Configure EJS view engine
  app.set('views', config.viewsDir);
  app.set('view engine', 'ejs');

  // 1. Enforce HTTPS in production
  app.use(enforceHttps);

  // 2. HTTP Security Headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
  app.use(configureSecurityHeaders);
  app.use(setPermissionsPolicy);

  // 3. CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin) || !config.isProduction) {
          callback(null, true);
        } else {
          callback(new Error('Origin blocked by CORS policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    }),
  );

  // 4. Resource Optimization: Gzip & Brotli Compression
  app.use(
    compression({
      level: 6,
      threshold: 1024, // Compress responses over 1KB
    }),
  );

  // 5. Structured HTTP Logging with Pino
  app.use(httpLogger);

  // 6. Cookie Parser
  app.use(cookieParser(config.sessionSecret));

  // 7. Body Parsing with Strict Payload Limits (Denial of Service defense)
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));

  // 8. Privacy Guard: Conceal robots.txt and sitemap.xml from public users
  app.get(['/robots.txt', '/sitemap.xml'], (req, res, next) => {
    const providedKey = req.headers['x-monitoring-key'] || req.query.key;
    if (providedKey === config.internalMonitoringKey) {
      return next(); // Allow authorized administrative access
    }
    res.status(404).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Resource Not Found',
      status: 404,
      detail: `The requested path ${req.path} was not found on this server.`,
    });
  });

  // 9. Static File Serving with CDN-friendly Cache-Control headers
  app.use(
    express.static(config.publicDir, {
      maxAge: config.isProduction ? '365d' : '0',
      etag: true,
      immutable: config.isProduction,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          // HTML files should revalidate
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      },
    }),
  );

  // 9. CSRF Protection for state mutations and template rendering
  app.use(csrfProtection);

  // 10. Direct Health and Metrics Probes
  app.use('/health', (req, res, next) => {
    // Forward /health to apiRouter's /health
    req.url = '/health';
    apiRouter(req, res, next);
  });
  app.use('/metrics', (req, res, next) => {
    req.url = '/metrics';
    apiRouter(req, res, next);
  });

  // 11. Application Routes
  app.use('/api', apiRouter);
  app.use('/', pagesRouter);

  // 12. Centralized 404 and Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export { app };
export default app;
