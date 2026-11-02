import crypto from 'node:crypto';
import { config } from '../config/index.js';

const CSRF_SALT_LENGTH = 16;

/**
 * Generates a cryptographically signed CSRF token
 * Token format: <salt_hex>.<hmac_signature_hex>
 */
export function generateCsrfToken(): string {
  const salt = crypto.randomBytes(CSRF_SALT_LENGTH).toString('hex');
  const hmac = crypto
    .createHmac('sha256', config.csrfSecret)
    .update(salt)
    .digest('hex');
  return `${salt}.${hmac}`;
}

/**
 * Validates a CSRF token using constant-time HMAC comparison
 */
export function verifyCsrfToken(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [salt, providedHmac] = parts;
  if (!salt || !providedHmac) return false;

  const expectedHmac = crypto
    .createHmac('sha256', config.csrfSecret)
    .update(salt)
    .digest('hex');

  const providedBuffer = Buffer.from(providedHmac, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
