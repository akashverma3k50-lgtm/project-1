import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '../../');
const isVercel = Boolean(process.env.VERCEL);

function resolveFirstExisting(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0]!;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isVercel,
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  sessionSecret: process.env.SESSION_SECRET || 'dev_session_secret_change_in_production_32chars!',
  csrfSecret: process.env.CSRF_SECRET || 'dev_csrf_secret_change_in_production_32chars!',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://localhost:3000')
    .split(',')
    .map((o) => o.trim()),

  internalMonitoringKey:
    process.env.INTERNAL_MONITORING_KEY || 'apex_internal_monitoring_secret_key',

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    contactMax: parseInt(
      process.env.CONTACT_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '5' : '50'),
      10
    ),
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    notificationEmail: process.env.CONTACT_NOTIFICATION_EMAIL || 'inquiries@example.com',
  },

  dbPath:
    process.env.DB_PATH ||
    (isVercel ? path.join('/tmp', 'app.db') : path.join(ROOT_DIR, 'data', 'app.db')),
  contentPath: resolveFirstExisting([
    path.join(process.cwd(), 'content', 'site-content.json'),
    path.join(ROOT_DIR, 'content', 'site-content.json'),
  ]),
  publicDir: resolveFirstExisting([
    path.join(process.cwd(), 'public'),
    path.join(ROOT_DIR, 'public'),
  ]),
  viewsDir: resolveFirstExisting([
    path.join(process.cwd(), 'src', 'views'),
    path.join(ROOT_DIR, 'src', 'views'),
    path.join(process.cwd(), 'views'),
  ]),
};
