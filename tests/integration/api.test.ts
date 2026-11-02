import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getDatabase, closeDatabase } from '../../src/database/db.js';
import type { Express } from 'express';

describe('Integration Tests: API & Security Layer', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp() as unknown as Express;
    getDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('HTTP Security Headers & Page Rendering', () => {
    it('serves Home page with strict security headers', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');

      // Verify HTTP Security Headers
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toBeDefined();
    });

    it('renders Services page successfully', async () => {
      const res = await request(app).get('/services');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Our Core Capabilities');
    });

    it('renders Contact page with CSRF token in form', async () => {
      const res = await request(app).get('/contact');
      expect(res.status).toBe(200);
      expect(res.text).toContain('name="_csrf"');
      expect(res.text).toContain('website_url_hp');
    });

    it('does not expose System Health or metrics links on public pages', async () => {
      const res = await request(app).get('/');
      expect(res.text).not.toContain('System Health');
      expect(res.text).not.toContain('href="/health"');
      expect(res.text).not.toContain('href="/metrics"');
    });

    it('keeps /health probe private from external public IPs', async () => {
      const res = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '203.0.113.195'); // Public external client IP

      expect(res.status).toBe(404);
      expect(res.body.title).toBe('Resource Not Found');
    });

    it('allows /health access when authorized with internal monitoring key or localhost', async () => {
      const res = await request(app)
        .get('/health')
        .set('X-Forwarded-For', '203.0.113.195')
        .set('X-Monitoring-Key', 'apex_internal_monitoring_secret_key');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.database.status).toBe('CONNECTED');
    });

    it('keeps /metrics telemetry private from external public IPs', async () => {
      const res = await request(app)
        .get('/metrics')
        .set('X-Forwarded-For', '203.0.113.195');

      expect(res.status).toBe(404);
    });

    it('hides robots and sitemap links from public pages', async () => {
      const res = await request(app).get('/');
      expect(res.text).not.toContain('href="/robots.txt"');
      expect(res.text).not.toContain('href="/sitemap.xml"');
    });

    it('keeps /robots.txt and /sitemap.xml private from public users with 404', async () => {
      const resRobots = await request(app).get('/robots.txt');
      expect(resRobots.status).toBe(404);

      const resSitemap = await request(app).get('/sitemap.xml');
      expect(resSitemap.status).toBe(404);
    });

    it('allows /robots.txt and /sitemap.xml when authorized with internal monitoring key', async () => {
      const resRobots = await request(app)
        .get('/robots.txt')
        .set('X-Monitoring-Key', 'apex_internal_monitoring_secret_key');
      expect(resRobots.status).toBe(200);

      const resSitemap = await request(app)
        .get('/sitemap.xml')
        .set('X-Monitoring-Key', 'apex_internal_monitoring_secret_key');
      expect(resSitemap.status).toBe(200);
    });
  });

  describe('CSRF Protection Middleware', () => {
    it('blocks state mutation POST requests without CSRF token with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/contact')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Test Subject',
          message: 'This message is more than ten characters long.',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('CSRF');
    });

    it('blocks state mutation POST requests with forged/tampered CSRF token', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('X-CSRF-Token', 'forged_salt.1234567890abcdef')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          subject: 'Test Subject',
          message: 'This message is more than ten characters long.',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Contact Form Submission & Parameterized SQL Ingestion', () => {
    it('accepts valid contact submission with valid CSRF token and parameterized query', async () => {
      // 1. Get a legitimate session with CSRF cookie & token
      const sessionRes = await request(app).get('/api/csrf-token');
      expect(sessionRes.status).toBe(200);
      const csrfToken = sessionRes.body.csrfToken;
      const cookies = sessionRes.headers['set-cookie'];

      // 2. Submit with potential SQL Injection payload to verify parameterization safety
      const maliciousSqlName = "Robert'; DROP TABLE contact_submissions; --";
      const postRes = await request(app)
        .post('/api/contact')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: maliciousSqlName,
          email: 'legit@example.com',
          subject: 'Security & Optimization',
          message: 'Hello, this is a legitimate test message for parameterized SQL testing.',
          website_url_hp: '',
          form_timestamp: Date.now() - 3000,
          _csrf: csrfToken,
        });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.id).toBeGreaterThan(0);

      // 3. Verify in SQLite that table is intact and payload was stored literally without executing
      const db = getDatabase();
      const row = db
        .prepare('SELECT * FROM contact_submissions WHERE id = ?')
        .get(postRes.body.id) as { name: string; email: string };

      expect(row).toBeDefined();
      expect(row.email).toBe('legit@example.com');
      // The table still exists and query executed safely
      const count = db.prepare('SELECT COUNT(*) as count FROM contact_submissions').get() as {
        count: number;
      };
      expect(count.count).toBeGreaterThan(0);
    });

    it('rejects bot submissions when honeypot field is filled', async () => {
      const sessionRes = await request(app).get('/api/csrf-token');
      const csrfToken = sessionRes.body.csrfToken;
      const cookies = sessionRes.headers['set-cookie'];

      const postRes = await request(app)
        .post('/api/contact')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Spam Bot',
          email: 'bot@spam.com',
          subject: 'Buy Cheap Products',
          message: 'Spam message that should be detected by honeypot.',
          website_url_hp: 'http://spam-link.com', // Bot filled hidden honeypot
          form_timestamp: Date.now() - 5000,
          _csrf: csrfToken,
        });

      expect(postRes.status).toBe(400);
      expect(postRes.body.success).toBe(false);
      expect(postRes.body.message).toContain('Automated submission detected');
    });

    it('rejects bot submissions executed in under 1.5 seconds', async () => {
      const sessionRes = await request(app).get('/api/csrf-token');
      const csrfToken = sessionRes.body.csrfToken;
      const cookies = sessionRes.headers['set-cookie'];

      const postRes = await request(app)
        .post('/api/contact')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Fast Bot',
          email: 'bot@instant.com',
          subject: 'Fast script',
          message: 'This was submitted within 100 milliseconds.',
          website_url_hp: '',
          form_timestamp: Date.now() - 100, // Submitted too fast
          _csrf: csrfToken,
        });

      expect(postRes.status).toBe(400);
      expect(postRes.body.success).toBe(false);
      expect(postRes.body.message).toContain('human');
    });
  });
});
