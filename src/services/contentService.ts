import fs from 'node:fs';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import type { SiteContent } from '../types/index.js';

let cachedContent: SiteContent | null = null;
let lastMtime = 0;

export function getSiteContent(): SiteContent {
  try {
    const stats = fs.statSync(config.contentPath);
    // Reload if modified or not yet cached
    if (!cachedContent || stats.mtimeMs > lastMtime) {
      const raw = fs.readFileSync(config.contentPath, 'utf-8');
      cachedContent = JSON.parse(raw) as SiteContent;
      lastMtime = stats.mtimeMs;
      logger.info('Loaded fresh site content configuration from file');
    }
    return cachedContent;
  } catch (err) {
    logger.error({ err }, 'Failed to read site-content.json, using fallback');
    if (cachedContent) return cachedContent;
    throw new Error('Site content file could not be loaded', { cause: err });
  }
}
