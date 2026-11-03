import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeEmail, contactFormSchema } from '../../src/utils/sanitizer.js';
import { generateCsrfToken, verifyCsrfToken } from '../../src/utils/csrf.js';

describe('Unit Tests: Input Sanitization & Security', () => {
  describe('sanitizeString', () => {
    it('escapes dangerous HTML script tags to prevent XSS', () => {
      const malicious = '<script>alert("xss")</script>';
      const clean = sanitizeString(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });

    it('strips null byte characters', () => {
      const payload = 'admin\0.txt';
      const clean = sanitizeString(payload);
      expect(clean).toBe('admin.txt');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '   Jane Doe   ';
      expect(sanitizeString(input)).toBe('Jane Doe');
    });

    it('returns empty string for non-string inputs', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(12345)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('lowercases and trims email addresses', () => {
      const email = '  Jane.Doe@EXAMPLE.COM ';
      expect(sanitizeEmail(email)).toBe('jane.doe@example.com');
    });

    it('returns empty string for non-string inputs', () => {
      expect(sanitizeEmail(null)).toBe('');
    });
  });

  describe('contactFormSchema Validation', () => {
    it('successfully parses and sanitizes a valid contact submission', () => {
      const rawInput = {
        name: '  Alex Smith  ',
        email: 'alex@example.com',
        subject: 'Website Project Inquiry',
        message: 'Hello, we would love to collaborate on a new website design.',
        website_url_hp: '',
        form_timestamp: Date.now() - 5000,
      };

      const result = contactFormSchema.safeParse(rawInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Alex Smith');
        expect(result.data.email).toBe('alex@example.com');
      }
    });

    it('rejects invalid email formats', () => {
      const rawInput = {
        name: 'Alex Smith',
        email: 'not-an-email',
        subject: 'Project Inquiry',
        message: 'Hello, this message is long enough to pass validation.',
      };

      const result = contactFormSchema.safeParse(rawInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues || [];
        const emailErr = issues.find((e) => e.path.includes('email'));
        expect(emailErr).toBeDefined();
      }
    });

    it('rejects messages shorter than 10 characters', () => {
      const rawInput = {
        name: 'Alex Smith',
        email: 'alex@example.com',
        subject: 'Hi',
        message: 'Too short',
      };

      const result = contactFormSchema.safeParse(rawInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues || [];
        const msgErr = issues.find((e) => e.path.includes('message'));
        expect(msgErr).toBeDefined();
      }
    });
  });

  describe('CSRF Token Generation & Verification', () => {
    it('generates a valid cryptographically signed token', () => {
      const token = generateCsrfToken();
      expect(typeof token).toBe('string');
      expect(token).toContain('.');
      expect(verifyCsrfToken(token)).toBe(true);
    });

    it('rejects invalid or tampered tokens', () => {
      const validToken = generateCsrfToken();
      const tamperedToken = validToken.slice(0, -4) + 'abcd';

      expect(verifyCsrfToken(tamperedToken)).toBe(false);
      expect(verifyCsrfToken('invalid.format')).toBe(false);
      expect(verifyCsrfToken('')).toBe(false);
      expect(verifyCsrfToken(null)).toBe(false);
      expect(verifyCsrfToken(undefined)).toBe(false);
    });
  });
});
